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

  function accessFor(user) {
    return {
      username: user.username,
      role: user.role || "student",
      allowed_levels: Array.isArray(user.allowedLevels) && user.allowedLevels.length ? user.allowedLevels : LEVELS,
      can_use_ai: false,
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
    supabaseAdminUsers: async () => {
      const user = await currentUser();
      if (!user || user.role !== "admin") throw new Error("Yönetici oturumu gerekli.");
      return { users: database.users.map(item => ({ id: item.id, name: item.name, username: item.username, access: accessFor(item) })) };
    },
    supabaseAdminContent: async () => {
      throw new Error("İçerik içe aktarma bu sürümde kapalı.");
    },
    supabaseTutor: async () => {
      throw new Error("Yapay zeka öğretmeni bu sürümde kapalı. Dersler uygulamanın kendi içeriğinden açılır.");
    },
    supabaseLiveToken: async () => {
      throw new Error("Canlı konuşma bu sürümde kapalı.");
    },
    geminiKeyStatus: async () => ({ configured: false }),
    geminiKeySave: async () => {
      throw new Error("Gemini anahtarı bu sürümde kullanılmıyor.");
    },
    geminiKeyRemove: async () => ({ configured: false })
  };
})();
