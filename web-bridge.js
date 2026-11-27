(() => {
  const DB_KEY = "deutschai-github-db-v1";
  const SESSION_KEY = "deutschai-github-session";
  const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
  let database = null;
  let sessionUser = null;

  function emptyDatabase() {
    return { version: 1, users: [], progress: {}, aiHistory: {} };
  }

  function saveDatabase() {
    localStorage.setItem(DB_KEY, JSON.stringify(database));
  }

  async function loadDatabase() {
    if (database) return database;
    try {
      const saved = JSON.parse(localStorage.getItem(DB_KEY) || "null");
      if (saved?.version === 1 && Array.isArray(saved.users)) {
        database = saved;
        return database;
      }
    } catch {}
    database = emptyDatabase();
    try {
      const response = await fetch("data/db.json", { cache: "no-store" });
      if (response.ok) {
        const seeded = await response.json();
        if (seeded?.version === 1 && Array.isArray(seeded.users)) database = seeded;
      }
    } catch {}
    saveDatabase();
    return database;
  }

  function readSession() {
    if (sessionUser) return sessionUser;
    try { sessionUser = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch { sessionUser = null; }
    return sessionUser;
  }

  function saveSession(user) {
    sessionUser = { id: user.id, email: user.email, username: user.username, name: user.name };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  }

  function clearSession() {
    sessionUser = null;
    localStorage.removeItem(SESSION_KEY);
  }

  async function hashPassword(password, salt) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function createSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function currentUser() {
    await loadDatabase();
    const session = readSession();
    if (!session?.id) return null;
    const user = database.users.find(item => item.id === session.id && item.isActive !== false);
    if (!user) {
      clearSession();
      return null;
    }
    return user;
  }

  const GEMINI_KEY = "deutschai-gemini-key";
  const TEXT_MODEL = "gemini-2.5-flash";
  const LIVE_MODEL = "models/gemini-3.8-live";

  function readGeminiKey() {
    return String(localStorage.getItem(GEMINI_KEY) || "").trim();
  }

  function hasGeminiKey() {
    return readGeminiKey().length >= 20;
  }

  function requireGeminiKey() {
    const key = readGeminiKey();
    if (key.length < 20) throw new Error("Sesli öğretmen için İlerleme sayfasına kendi Gemini API anahtarını ekle. Anahtar yalnız bu tarayıcıda saklanır.");
    return key;
  }

  async function geminiError(response) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || `Gemini yanıt vermedi (${response.status}).`;
    if (/API key|api key|API_KEY_INVALID|permission/i.test(message)) throw new Error("Gemini API anahtarı geçersiz. İlerleme sayfasından yeni anahtarı kaydet.");
    throw new Error(message);
  }

  function teacherBrief() {
    try { return window.deutschaiTeacherBrief?.() || ""; }
    catch { return ""; }
  }

  async function geminiJson(input = {}) {
    const key = requireGeminiKey();
    const task = String(input.task || "lesson");
    const text = String(input.text || "");
    const profile = input.profile ? JSON.stringify(input.profile).slice(0, 6000) : "{}";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${teacherBrief()}\n\nYalnızca geçerli bir JSON nesnesi döndür. Markdown ve açıklama ekleme.` }] },
        contents: [{ role: "user", parts: [{ text: `Görev: ${task}\nÖğrenci profili: ${profile}\nİstek:\n${text}` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4 }
      })
    });
    if (!response.ok) await geminiError(response);
    const data = await response.json();
    const raw = (data.candidates?.[0]?.content?.parts || []).map(part => part.text || "").join("").trim();
    try { return JSON.parse(raw.replace(/^```json\s*|```$/g, "").trim()); }
    catch { throw new Error("Gemini geçerli bir JSON yanıtı vermedi."); }
  }

  async function mintLiveToken() {
    const key = requireGeminiKey();
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ uses: 1 })
    });
    if (!response.ok) await geminiError(response);
    const data = await response.json();
    if (!data?.name) throw new Error("Gemini canlı oturum anahtarı alınamadı.");
    return { token: data.name, model: LIVE_MODEL };
  }

  function accessFor(user) {
    return {
      username: user.username,
      role: user.role || "student",
      allowed_levels: Array.isArray(user.allowedLevels) && user.allowedLevels.length ? user.allowedLevels : LEVELS,
      can_use_ai: user.canUseAi !== false,
      is_active: user.isActive !== false
    };
  }

  function publicUser(user) {
    return { id: user.id, email: user.email, username: user.username, name: user.name };
  }

  async function registerAccount(input = {}) {
    await loadDatabase();
    const email = String(input.email || "").trim().toLowerCase();
    const username = String(input.username || "").trim().toLowerCase();
    const firstName = String(input.firstName || "").trim();
    const lastName = String(input.lastName || "").trim();
    const password = String(input.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Geçerli bir e-posta gir.");
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("Kullanıcı adı 3-32 karakter olmalı; harf, rakam, nokta, alt çizgi veya tire kullan.");
    if (firstName.length < 2 || lastName.length < 2) throw new Error("İsim ve soyisim gir.");
    if (password.length < 8) throw new Error("Şifre en az 8 karakter olmalı.");
    if (database.users.some(user => user.email === email)) throw new Error("Bu e-posta ile kayıtlı bir hesap var.");
    if (database.users.some(user => user.username === username)) throw new Error("Bu kullanıcı adı alınmış.");
    const salt = createSalt();
    const user = {
      id: crypto.randomUUID(),
      email,
      username,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      passwordHash: await hashPassword(password, salt),
      salt,
      role: "student",
      allowedLevels: LEVELS,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    database.users.push(user);
    database.progress[user.id] = null;
    saveDatabase();
    saveSession(user);
    return { user: publicUser(user) };
  }

  async function loginAccount(input = {}) {
    await loadDatabase();
    const identity = String(input.username || input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    if (!identity || password.length < 8) throw new Error("E-posta veya kullanıcı adı ve en az 8 karakterli şifre gir.");
    const user = database.users.find(item => item.email === identity || item.username === identity);
    if (!user || !user.isActive) throw new Error("Hesap bulunamadı.");
    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) throw new Error("Şifre hatalı.");
    saveSession(user);
    return { user: publicUser(user) };
  }

  window.deutschaiDesktop = {
    notifyStartupReady() {},
    supabaseStatus: async () => {
      const user = await currentUser();
      return { configured: true, session: user ? { user: publicUser(user) } : null };
    },
    supabaseLogin: loginAccount,
    supabaseRegister: registerAccount,
    supabaseAccess: async () => {
      const user = await currentUser();
      if (!user) throw new Error("Oturum açman gerekiyor.");
      return accessFor(user);
    },
    supabaseLogout: async () => {
      clearSession();
      return { ok: true };
    },
    supabaseGetProgress: async () => {
      const user = await currentUser();
      if (!user) throw new Error("Oturum açman gerekiyor.");
      return database.progress[user.id] || null;
    },
    supabaseSaveProgress: async document => {
      const user = await currentUser();
      if (!user) throw new Error("Oturum açman gerekiyor.");
      database.progress[user.id] = document;
      saveDatabase();
      return { ok: true };
    },
    supabaseAIContentHistory: async () => {
      const user = await currentUser();
      if (!user) throw new Error("Oturum açman gerekiyor.");
      return database.aiHistory[user.id] || [];
    },
    supabaseSaveAIContent: async input => {
      const user = await currentUser();
      if (!user) throw new Error("Oturum açman gerekiyor.");
      const level = String(input?.level || "").toUpperCase();
      const content = input?.content;
      if (input?.task !== "diagnosticGrade" || !LEVELS.includes(level) || !content || typeof content !== "object") {
        throw new Error("Seviye tespit sonucu doğrulanamadı.");
      }
      const history = database.aiHistory[user.id] || [];
      history.unshift({ task: "diagnosticGrade", level, content, created_at: new Date().toISOString() });
      database.aiHistory[user.id] = history.slice(0, 30);
      saveDatabase();
      return { ok: true };
    },
    supabaseCurriculum: async () => ({ lessons: [] }),
    supabaseAdminUsers: async (input = {}) => {
      const actor = await currentUser();
      if (!actor || actor.role !== "admin") throw new Error("Yönetici oturumu gerekli.");
      const action = input.action || "list";
      if (action === "list") {
        return { users: database.users.map(item => ({ id: item.id, name: item.name, username: item.username, access: accessFor(item) })) };
      }
      const target = database.users.find(item => item.id === input.userId);
      if (!target) throw new Error("Hesap bulunamadı.");
      if (action === "update") {
        if (input.role === "student" || input.role === "teacher" || input.role === "admin") target.role = input.role;
        if (Array.isArray(input.allowedLevels)) target.allowedLevels = input.allowedLevels.filter(level => LEVELS.includes(level));
        if (typeof input.canUseAi === "boolean") target.canUseAi = input.canUseAi;
        if (typeof input.isActive === "boolean") target.isActive = input.isActive;
        saveDatabase();
        return { ok: true };
      }
      if (action === "setPassword") {
        const password = String(input.password || "");
        if (password.length < 8) throw new Error("Şifre en az 8 karakter olmalı.");
        target.salt = createSalt();
        target.passwordHash = await hashPassword(password, target.salt);
        saveDatabase();
        return { ok: true };
      }
      throw new Error("Bu yönetici işlemi desteklenmiyor.");
    },
    supabaseAdminContent: async () => {
      throw new Error("İçerik içe aktarma bu sürümde kapalı.");
    },
    supabaseTutor: async input => geminiJson(input),
    supabaseLiveToken: async () => mintLiveToken(),
    geminiKeyStatus: async () => ({ configured: hasGeminiKey() }),
    geminiKeySave: async value => {
      const key = String(value || "").trim();
      if (key.length < 20) throw new Error("Gemini API anahtarı eksik veya çok kısa.");
      localStorage.setItem(GEMINI_KEY, key);
      return { configured: true };
    },
    geminiKeyRemove: async () => {
      localStorage.removeItem(GEMINI_KEY);
      return { configured: false };
    },
    changePassword: async ({ current, next } = {}) => {
      const user = await currentUser();
      if (!user) throw new Error("Oturum açman gerekiyor.");
      const currentPassword = String(current || "");
      const nextPassword = String(next || "");
      if (nextPassword.length < 8) throw new Error("Yeni şifre en az 8 karakter olmalı.");
      if (await hashPassword(currentPassword, user.salt) !== user.passwordHash) throw new Error("Mevcut şifre hatalı.");
      user.salt = createSalt();
      user.passwordHash = await hashPassword(nextPassword, user.salt);
      saveDatabase();
      return { ok: true };
    }
  };
})();
