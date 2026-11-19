(() => {
  const CONFIG = {
    url: "https://htskszlbacwlltmiywes.supabase.co",
    key: "sb_publishable_0_RtwICcy4cR2p1bskq2pA_Vv71BxQX"
  };
  const SESSION_KEY = "deutschai-web-session";
  let supabaseSession = null;
  let supabaseRefreshPromise = null;

  function supabaseConfig() {
    const url = String(CONFIG.url || "").trim().replace(/\/+$/, "");
    const key = String(CONFIG.key || "").trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || key.length < 20) return null;
    return { url, key };
  }

  function readSupabaseSession() {
    if (supabaseSession) return supabaseSession;
    try { supabaseSession = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch { supabaseSession = null; }
    return supabaseSession;
  }

  function saveSupabaseSession(sessionValue) {
    if (!sessionValue?.access_token || !sessionValue?.refresh_token) {
      throw new Error("Oturum kaydedilemedi.");
    }
    sessionValue.expires_at = sessionValue.expires_at || Math.floor(Date.now() / 1000) + Number(sessionValue.expires_in || 3600);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionValue));
    supabaseSession = sessionValue;
  }

  function clearSupabaseSession() {
    supabaseSession = null;
    localStorage.removeItem(SESSION_KEY);
  }

  function geminiStorageKey(userId) {
    if (!/^[0-9a-f-]{36}$/i.test(String(userId || ""))) throw new Error("Kullanıcı hesabı doğrulanamadı.");
    return `deutschai-web-gemini:${userId}`;
  }

  function readGeminiKey(userId) {
    try { return localStorage.getItem(geminiStorageKey(userId)) || ""; }
    catch { return ""; }
  }

  async function supabaseRequest(route, { method = "GET", body, token, prefer, timeout = 20000 } = {}) {
    const config = supabaseConfig();
    if (!config) throw new Error("Supabase bağlantısı ayarlanmamış.");
    const headers = { apikey: config.key, "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (prefer) headers.Prefer = prefer;
    let response;
    try {
      response = await fetch(`${config.url}${route}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeout)
      });
    } catch (error) {
      throw new Error(error?.name === "TimeoutError" ? "Supabase bağlantısı zaman aşımına uğradı." : "Supabase sunucusuna bağlanılamadı. İnternet bağlantısını kontrol et.");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.msg || data?.message || data?.error_description || data?.error || "İstek reddedildi.";
      const error = new Error(String(message).slice(0, 240));
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function currentSupabaseSession() {
    const sessionValue = readSupabaseSession();
    if (!sessionValue) return null;
    if (Number(sessionValue.expires_at || 0) <= Math.floor(Date.now() / 1000) + 60) {
      if (!supabaseRefreshPromise) {
        supabaseRefreshPromise = supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          body: { refresh_token: sessionValue.refresh_token }
        }).then(refreshed => { saveSupabaseSession(refreshed); }).catch(error => {
          if (error.status === 400 || error.status === 401) clearSupabaseSession();
          throw error;
        });
      }
      try { await supabaseRefreshPromise; }
      catch { return null; }
      finally { supabaseRefreshPromise = null; }
    }
    try {
      const user = await supabaseRequest("/auth/v1/user", { token: supabaseSession.access_token });
      return { user: { id: user.id, email: user.email }, expiresAt: supabaseSession.expires_at };
    } catch (error) {
      if (error.status === 401 || error.status === 403) { clearSupabaseSession(); return null; }
      throw error;
    }
  }

  async function supabaseAuth(input = {}) {
    const username = String(input.username || input.email || "").trim().toLowerCase();
    const email = username.includes("@") ? username : `${username}@login.deutschai.invalid`;
    const password = String(input.password || "");
    if (!username || password.length < 8) throw new Error("Kullanıcı adı ve en az 8 karakterli parola gir.");
    const result = await supabaseRequest("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
    saveSupabaseSession(result);
    return { user: { id: result.user.id, email: result.user.email, username } };
  }

  async function getCurrentAccess() {
    const current = await currentSupabaseSession();
    if (!current) throw new Error("Oturum açman gerekiyor.");
    const rows = await supabaseRequest(`/rest/v1/user_access?select=username,role,allowed_levels,can_use_ai,is_active&user_id=eq.${encodeURIComponent(current.user.id)}&limit=1`, { token: supabaseSession.access_token });
    return rows?.[0] || null;
  }

  async function requireActiveAccess() {
    const access = await getCurrentAccess();
    if (!access?.is_active) throw new Error("Hesap devre dışı veya yetkisi kaldırılmış. Yöneticine başvur.");
    return access;
  }

  window.deutschaiDesktop = {
    notifyStartupReady() {},
    supabaseStatus: async () => ({ configured: !!supabaseConfig(), session: await currentSupabaseSession() }),
    supabaseLogin: input => supabaseAuth(input),
    supabaseAccess: async () => {
      let access = await getCurrentAccess();
      if (!access) {
        const current = await currentSupabaseSession();
        if (!current) throw new Error("Oturum açman gerekiyor.");
        await supabaseRequest("/functions/v1/admin-users", {
          method: "POST",
          token: supabaseSession.access_token,
          body: { action: "bootstrap" }
        });
        access = await getCurrentAccess();
      }
      if (!access?.is_active) throw new Error("Hesap devre dışı veya yetkisi kaldırılmış. Yöneticine başvur.");
      return access;
    },
    supabaseLogout: async () => {
      const current = readSupabaseSession();
      if (current?.access_token) {
        try { await supabaseRequest("/auth/v1/logout", { method: "POST", token: current.access_token }); }
        catch {}
      }
      clearSupabaseSession();
      return { ok: true };
    },
    supabaseGetProgress: async () => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Oturum açman gerekiyor.");
      await requireActiveAccess();
      const rows = await supabaseRequest(`/rest/v1/learner_progress?select=document&user_id=eq.${encodeURIComponent(current.user.id)}&limit=1`, { token: supabaseSession.access_token });
      return rows?.[0]?.document || null;
    },
    supabaseSaveProgress: async document => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Oturum açman gerekiyor.");
      await requireActiveAccess();
      await supabaseRequest("/rest/v1/learner_progress?on_conflict=user_id", {
        method: "POST",
        token: supabaseSession.access_token,
        prefer: "resolution=merge-duplicates,return=minimal",
        body: { user_id: current.user.id, document, updated_at: new Date().toISOString() }
      });
      return { ok: true };
    },
    supabaseAIContentHistory: async () => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Oturum açman gerekiyor.");
      const access = await requireActiveAccess();
      if (!access.can_use_ai) throw new Error("Bu hesapta AI öğretmen yetkisi açık değil.");
      return supabaseRequest("/rest/v1/ai_generated_content?select=task,level,content,created_at&order=created_at.desc&limit=30", { token: supabaseSession.access_token });
    },
    supabaseSaveAIContent: async input => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Oturum açman gerekiyor.");
      const access = await requireActiveAccess();
      if (!access.can_use_ai) throw new Error("Bu hesapta AI öğretmen yetkisi açık değil.");
      const task = String(input?.task || "");
      const level = String(input?.level || "").toUpperCase();
      const content = input?.content;
      if (task !== "diagnosticGrade" || !Array.isArray(access.allowed_levels) || !access.allowed_levels.includes(level) || !content || typeof content !== "object" || JSON.stringify(content).length > 30000) {
        throw new Error("Seviye tespit sonucu doğrulanamadı.");
      }
      await supabaseRequest("/rest/v1/ai_generated_content", {
        method: "POST",
        token: supabaseSession.access_token,
        prefer: "return=minimal",
        body: { user_id: current.user.id, task, level, content }
      });
      return { ok: true };
    },
    supabaseCurriculum: async () => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Oturum açman gerekiyor.");
      const access = await requireActiveAccess();
      const levels = new Set(access.allowed_levels || []);
      const token = supabaseSession.access_token;
      const [courses, lessons, vocabulary, grammar, questions] = await Promise.all([
        supabaseRequest("/rest/v1/curriculum_courses?select=*&published=eq.true&order=sort_order.asc", { token }),
        supabaseRequest("/rest/v1/curriculum_lessons?select=*&published=eq.true&order=sort_order.asc", { token }),
        supabaseRequest("/rest/v1/curriculum_vocabulary?select=*&published=eq.true&order=de.asc", { token }),
        supabaseRequest("/rest/v1/curriculum_grammar?select=*&published=eq.true&order=level.asc", { token }),
        supabaseRequest("/rest/v1/question_bank?select=*&review_status=eq.approved&order=created_at.asc", { token })
      ]);
      const skillName = { grammar: "grammatik", vocabulary: "wortschatz", reading: "lesen", listening: "horen", writing: "schreiben", speaking: "sprechen" };
      return {
        courses: courses.filter(item => levels.has(item.level)).map(item => ({ ...item, position: item.sort_order })),
        lessons: lessons.filter(item => levels.has(item.level)).map(item => ({ ...item.content, id: item.id, course_id: item.course_id, level: item.level, title: item.title, position: item.sort_order })),
        vocabulary: vocabulary.filter(item => levels.has(item.level)).map(item => ({ de: item.de, article: item.article, plural: item.plural, tr: item.tr, example_de: item.example_de, example_tr: item.example_tr, level: item.level, category: item.category })),
        grammar: grammar.filter(item => levels.has(item.level)).map(item => ({ id: item.id, level: item.level, title: item.title, explanation_tr: item.explanation_tr, comparisons: item.comparisons })),
        exercises: questions.filter(item => levels.has(item.level)).map(item => ({ id: item.id, skill: skillName[item.skill] || item.skill, level: item.level, prompt: item.prompt?.text || "", options: item.prompt?.options || [], passage: item.prompt?.passage || null, audio_text: item.prompt?.audio_text || null, answer: item.answer, explanation: item.explanation?.tr || "" }))
      };
    },
    supabaseAdminUsers: async input => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Yönetici oturumu gerekli.");
      return supabaseRequest("/functions/v1/admin-users", { method: "POST", token: supabaseSession.access_token, body: input });
    },
    supabaseAdminContent: async input => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Yönetici oturumu gerekli.");
      const access = await requireActiveAccess();
      if (access.role !== "admin") throw new Error("Açık kaynak içerik yönetimi yalnızca yöneticiye açık.");
      const body = { ...(input || {}) };
      if (body.action === "process") {
        body.apiKey = readGeminiKey(current.user.id);
        if (!body.apiKey) throw new Error("Önce yönetici hesabının Gemini API anahtarını ekle.");
      }
      return supabaseRequest("/functions/v1/process-content-import", {
        method: "POST",
        token: supabaseSession.access_token,
        body,
        timeout: 90000
      });
    },
    supabaseTutor: async input => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Oturum açman gerekiyor.");
      const access = await requireActiveAccess();
      if (!access.can_use_ai) throw new Error("Bu hesapta AI öğretmen yetkisi açık değil. Yöneticine başvur.");
      const apiKey = readGeminiKey(current.user.id);
      if (!apiKey) throw new Error("Önce kendi Gemini API anahtarını ekle.");
      return supabaseRequest("/functions/v1/deutschai-ai", {
        method: "POST",
        token: supabaseSession.access_token,
        body: { action: "tutor", input, apiKey },
        timeout: input?.task === "daily" ? 45000 : input?.task === "exam" && /A1-C2 kapsamlı Almanca seviye tespit sınavı/.test(input?.text || "") ? 55000 : ["exam", "evaluate", "lesson"].includes(input?.task) ? 30000 : 90000
      });
    },
    supabaseLiveToken: async input => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Oturum açman gerekiyor.");
      const access = await requireActiveAccess();
      if (!access.can_use_ai) throw new Error("Bu hesapta AI öğretmen yetkisi açık değil. Yöneticine başvur.");
      const apiKey = readGeminiKey(current.user.id);
      if (!apiKey) throw new Error("Önce kendi Gemini API anahtarını ekle.");
      return supabaseRequest("/functions/v1/deutschai-ai", {
        method: "POST",
        token: supabaseSession.access_token,
        body: { action: "liveToken", ...input, apiKey }
      });
    },
    geminiKeyStatus: async () => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Oturum açman gerekiyor.");
      return { configured: !!readGeminiKey(current.user.id) };
    },
    geminiKeySave: async value => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Oturum açman gerekiyor.");
      await requireActiveAccess();
      const key = String(value || "").trim();
      if (key.length < 20 || key.length > 256 || /\s/.test(key)) throw new Error("Geçerli Gemini API anahtarını gir.");
      localStorage.setItem(geminiStorageKey(current.user.id), key);
      return { configured: true };
    },
    geminiKeyRemove: async () => {
      const current = await currentSupabaseSession();
      if (!current) throw new Error("Oturum açman gerekiyor.");
      localStorage.removeItem(geminiStorageKey(current.user.id));
      return { configured: false };
    }
  };
})();
