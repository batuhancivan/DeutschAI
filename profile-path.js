(() => {
  const GOAL_OPTIONS = ["Sıfırdan, alfabeden başla", "Günlük konuşma", "Goethe-Zertifikat A1", "Goethe-Zertifikat A2", "Goethe-Zertifikat B1", "İş Almancası"];
  const ZERO_STEPS = [
    { title: "Alfabe ve sesler", focus: "A, E, I, O, U ve ch, sch, ei sesleri", de: "Ich heiße …", tr: "Benim adım …" },
    { title: "Selamlaşma", focus: "Hallo, Guten Tag, Guten Morgen, Tschüs", de: "Guten Tag! Wie geht es Ihnen?", tr: "İyi günler! Nasılsınız?" },
    { title: "Kendini tanıtma", focus: "heißen, kommen aus, wohnen", de: "Ich komme aus der Türkei.", tr: "Türkiye'den geliyorum." },
    { title: "der, die, das", focus: "İsmin cinsiyeti ve bir örnekle ezber", de: "Das ist ein Buch.", tr: "Bu bir kitap." },
    { title: "sein: olmak", focus: "ich bin, du bist, er ist", de: "Ich bin müde.", tr: "Yorgunum." },
    { title: "haben: sahip olmak", focus: "ich habe, du hast, er hat", de: "Ich habe einen Bruder.", tr: "Bir erkek kardeşim var." },
    { title: "Sayılar ve saat", focus: "1–12 ve Wie spät ist es?", de: "Es ist drei Uhr.", tr: "Saat üç." },
    { title: "Şimdiki zaman", focus: "Düzenli fiil, fiil ikinci sırada", de: "Ich lerne Deutsch.", tr: "Almanca öğreniyorum." },
    { title: "Yiyecek ve sipariş", focus: "Ich möchte … bitte", de: "Ich möchte einen Kaffee, bitte.", tr: "Bir kahve istiyorum, lütfen." },
    { title: "Soru sormak", focus: "Fiil başa gelir, W-Fragen", de: "Wo wohnst du?", tr: "Nerede oturuyorsun?" },
    { title: "Aile ve ev", focus: "Mutter, Vater, Haus, Zimmer", de: "Meine Mutter wohnt in Ankara.", tr: "Annem Ankara'da oturuyor." },
    { title: "İlk kısa konuşma", focus: "Selam, isim, memleket, bir soru", de: "Hallo! Ich heiße Ali. Und du?", tr: "Merhaba! Adım Ali. Ya sen?" }
  ];

  function learner() { return window.deutschaiLearner || {}; }
  function pathMode() { return localStorage.getItem("deutschai-learn-path") || "level"; }
  function stepIndex() { return Math.max(0, Math.min(ZERO_STEPS.length - 1, Number(localStorage.getItem("deutschai-zero-step") || 0))); }

  window.deutschaiTeacherBrief = () => {
    const data = learner();
    const profile = data.profile?.() || {};
    const placement = data.placement?.() || null;
    const exam = data.exam?.() || null;
    const user = data.user?.() || {};
    const level = placement?.level || exam?.results?.overall || profile.level || "henüz keşfedilmedi";
    const goals = (Array.isArray(profile.goals) && profile.goals.length ? profile.goals : [profile.goal || "Günlük konuşma"]).join(", ");
    const skills = (exam?.results?.skills || []).map(skill => `${skill.name}: ${skill.level} (${skill.score ?? "puan yok"})`).join("; ");
    const zero = pathMode() === "zero";
    const step = ZERO_STEPS[stepIndex()];
    const profilePrompt = [
      "Sen Felkan'sın. Türkçe konuşan bir yetişkine Almanca öğreten sabırlı öğretmensin.",
      "Bu metin öğrencinin profilidir. Her ders, her değerlendirme ve her sesli konuşma bu profilin dışına çıkmaz.",
      `Öğrencinin adı: ${user.name || user.username || "öğrenci"}.`,
      `Gemini'nin keşfettiği Almanca seviyesi: ${level}.`,
      placement?.confidence ? `Keşif güveni: ${placement.confidence}.` : "Seviye henüz bir sınavla doğrulanmadıysa bunu uydurma; A1 öncesi kabul et.",
      placement?.rationaleTr ? `Keşfin gerekçesi: ${placement.rationaleTr}` : "",
      skills ? `Beceri dökümü: ${skills}.` : "Beceri dökümü yok. Konuşma, yazma, dinleme, okuma, gramer ve kelimeyi ayrı ayrı gözle.",
      `Hedefler: ${goals}.`,
      `Günlük çalışma süresi: ${Number(profile.dailyMinutes) || 30} dakika. Dersi bu süreyi aşmayacak parçalara böl.`,
      (profile.focusAreas || placement?.focusAreas || []).length ? `Zayıf alanlar: ${(profile.focusAreas || placement.focusAreas).join(", ")}.` : "Zayıf alan kaydı yok. Hata gördüğünde o konuyu bir sonraki örneğin merkezi yap.",
      "Kurallar: Tek seferde tek yeni bilgi ver. Önce kısa Almanca örnek, hemen altında Türkçe anlamı. Sonra öğrenciden tek cümle üretmesini iste.",
      "Düzeltirken önce doğru Almanca cümleyi söyle, sonra hatayı tek cümle Türkçe açıkla, ardından konuşmayı Almanca sürdür.",
      "Seviyenin üstündeki zaman, yan cümle veya deyim kullanma. Bilinmeyen kelimeyi cümlede kullanmadan önce Türkçesini ver.",
      "Öğrenciyi çocuk gibi konuşturma. Kısa, net ve teşvik edici ol. Uydurma puan veya uydurma sınav sonucu yazma."
    ].filter(Boolean).join("\n");
    if (!zero) return profilePrompt;
    return [
      profilePrompt,
      "",
      "AKTİF BÖLÜM: SIFIRDAN ALMANCA.",
      "Öğrenci bu bölümde hiç Almanca bilmiyor kabul edilir. Keşfedilen seviye ne olursa olsun bu oturumda müfredatın başına dön.",
      "Öğretme sırası bozulmaz: 1 ses ve alfabe, 2 selam, 3 kendini tanıtma, 4 der/die/das, 5 sein, 6 haben, 7 sayı ve saat, 8 Präsens, 9 sipariş, 10 soru, 11 aile ve ev, 12 ilk diyalog.",
      `Şu anki adım ${stepIndex() + 1}/12: ${step.title}. Odak yalnız şu: ${step.focus}.`,
      "Bu adım bitmeden sonraki adıma geçme. Adımın sonunda öğrenciden tam olarak bir Almanca cümle iste.",
      "Telaffuzu Türkçe benzetmeyle anlat: ch boğazdan hırıltılı, ei 'ay' gibi, ie 'i' gibi uzar, sp ve st başta 'şp' ve 'şt' duyulur, z 'ts' diye okunur.",
      "Artikel'i isimden ayırma. Her yeni ismi der/die/das ile ver ve öğrenciden aynı şekilde tekrar etmesini iste.",
      "Gramer tablosu en fazla altı satır olsun. Tabloyu bir örnek cümle izlesin.",
      "Yanlış artikel, yanlış fiil sırası veya eksik fiil görürsen önce doğru cümleyi yaz, nedenini bir Türkçe cümleyle söyle.",
      "Almanca cümleler A1 öncesi kalsın: bir özne, bir fiil, en fazla bir nesne. Nebensatz, Perfekt ve Dativ bu bölümde yasaktır.",
      "Her yanıtta sıra şudur: bugünkü ses veya kalıp, iki örnek (Almanca ve Türkçe), öğrencinin kuracağı tek cümle, o cümle için ipucu.",
      "Öğrenci sustuysa ipucunu Türkçe ver ve Almanca kalıbı bir kez daha söyle. Asla uzun paragraf anlatma."
    ].join("\n");
  };

  function promptBlock(text) {
    return `<pre class="learner-prompt">${escapeHtml(text)}</pre>`;
  }

  function profilePage() {
    const data = learner();
    const profile = data.profile?.() || {};
    const placement = data.placement?.() || null;
    const exam = data.exam?.() || null;
    const user = data.user?.() || {};
    const level = placement?.level || exam?.results?.overall || "";
    const goals = new Set(Array.isArray(profile.goals) ? profile.goals : (profile.goal ? [profile.goal] : []));
    const skills = exam?.results?.skills || [];
    localStorage.setItem("deutschai-learn-path", "level");
    const displayName = user.name || user.username || "Öğrenci";
    shell("Profil", `
      <section class="learner-level"><span>GEMINI'NİN KEŞFETTİĞİ SEVİYE · ${escapeHtml(displayName)}</span><strong>${level ? escapeHtml(level) : "Henüz yok"}</strong><p>${level ? escapeHtml(placement?.rationaleTr || "Bu seviye seviye tespiti ve öğretmen kayıtlarından geldi.") : "Seviye tespiti yapılmadı. Felkan konuşma sınavından sonra seviyeyi buraya yazar."}</p><button class="btn" onclick="setPage('placement')">Seviyeyi keşfet</button></section>
      <section class="card learner-settings" id="learner-account"><h2>Hesap</h2><p class="learner-identity"><b>${escapeHtml(displayName)}</b><span>${escapeHtml(user.username || "")}${user.email ? " · " + escapeHtml(user.email) : ""}</span></p><form id="learner-password" class="learner-custom"><span>Şifre</span><input id="learner-password-current" type="password" autocomplete="current-password" minlength="8" placeholder="Mevcut şifre" required><input id="learner-password-next" type="password" autocomplete="new-password" minlength="8" placeholder="Yeni şifre, en az 8 karakter" required><button class="btn ghost" type="submit">Şifreyi güncelle</button></form><p id="learner-account-note" class="muted"></p><button class="btn ghost" type="button" onclick="window.deutschaiLocalAccount.logout()">Çıkış yap</button></section>
      <section class="card learner-settings"><h2>Görünüm</h2><p class="muted">Renk ve aydınlık tercihin yalnız bu cihazda kalır.</p><div class="theme-swatches" id="learner-themes"></div><button class="btn ghost" id="learner-theme-mode" type="button"></button></section>
      <section class="card learner-settings"><h2>Gemini bağlantısı</h2><p id="profile-gemini-status" class="muted">Bağlantı kontrol ediliyor…</p><p class="muted">Anahtarı yalnız yönetici, Yönetim sayfasından bir kez kaydeder. Bu tarayıcıdaki bütün hesaplar onu kullanır.</p></section>
      ${skills.length ? `<section class="card"><h2>Beceri dökümü</h2><div class="learner-skills">${skills.map(skill => `<article><b>${escapeHtml(skill.name || "")}</b><strong>${escapeHtml(skill.level || "")}</strong><small>${escapeHtml(skill.score ?? "")} puan</small></article>`).join("")}</div></section>` : ""}
      <section class="card"><h2>Hedefler</h2><p class="muted">Seçtiklerin öğretmen yönergesine aynen yazılır.</p><div class="learner-goals">${GOAL_OPTIONS.map(goal => `<button type="button" class="goal-chip ${goals.has(goal) ? "is-on" : ""}" data-goal="${escapeHtml(goal)}">${escapeHtml(goal)}</button>`).join("")}</div><label class="learner-custom">Kendi hedefin<input id="learner-custom-goal" maxlength="100" value="${escapeHtml(profile.customGoal || "")}" placeholder="Örneğin: Almanya'da doktorda konuşmak"></label><label class="learner-custom">Günlük süre<select id="learner-minutes">${[15, 20, 30, 45, 60, 90].map(min => `<option value="${min}" ${Number(profile.dailyMinutes) === min ? "selected" : ""}>${min} dakika</option>`).join("")}</select></label><button class="btn" id="learner-save" type="button">Profili ve yönergeyi kaydet</button><p id="learner-note" class="muted">${sessionStorage.getItem("deutschai-profile-saved") === "1" ? "Kaydedildi. Yönerge yeni hedefe göre güncellendi." : ""}</p></section>
      <section class="card"><h2>Öğretmene giden tam yönerge</h2><p class="muted">Felkan her ders ve sesli konuşmada bu metni eksiksiz okur.</p>${promptBlock(window.deutschaiTeacherBrief())}</section>`);
    sessionStorage.removeItem("deutschai-profile-saved");
    mountProfileSettings();
    document.querySelectorAll(".goal-chip").forEach(button => button.onclick = () => button.classList.toggle("is-on"));
    document.querySelector("#learner-save").onclick = () => {
      const selected = [...document.querySelectorAll(".goal-chip.is-on")].map(button => button.dataset.goal);
      const custom = document.querySelector("#learner-custom-goal").value.trim();
      const nextGoals = custom ? [...selected, custom] : selected;
      data.save?.({ goals: nextGoals.length ? nextGoals : ["Günlük konuşma"], goal: (nextGoals[0] || "Günlük konuşma").slice(0, 100), customGoal: custom, dailyMinutes: Number(document.querySelector("#learner-minutes").value) || 30 });
      sessionStorage.setItem("deutschai-profile-saved", "1");
      profilePage();
    };
  }

  function mountProfileSettings() {
    const colors = [["light", "Yeşil", "#167461"], ["ocean", "Mavi", "#3978c5"], ["violet", "Mor", "#7957c8"], ["rose", "Pembe", "#c05f7a"], ["sunset", "Turuncu", "#c47a24"]];
    const selected = typeof baseTheme === "function" ? baseTheme() : "light";
    const swatches = document.querySelector("#learner-themes");
    swatches.innerHTML = colors.map(([id, name, color]) => `<button type="button" class="theme-swatch ${selected === id ? "selected" : ""}" style="--swatch:${color}" aria-label="${name} teması" title="${name}" data-theme="${id}"></button>`).join("");
    swatches.querySelectorAll("[data-theme]").forEach(button => { button.onclick = () => setTheme(button.dataset.theme); });
    const mode = document.querySelector("#learner-theme-mode");
    mode.textContent = typeof isDarkTheme === "function" && isDarkTheme() ? "Açık temaya geç" : "Koyu temaya geç";
    mode.onclick = () => toggleTheme();
    document.querySelector("#learner-password").onsubmit = async event => {
      event.preventDefault();
      const note = document.querySelector("#learner-account-note");
      const current = document.querySelector("#learner-password-current").value;
      const next = document.querySelector("#learner-password-next").value;
      note.textContent = "Şifre güncelleniyor…";
      try {
        await window.deutschaiDesktop.changePassword({ current, next });
        event.target.reset();
        note.textContent = "Şifre güncellendi.";
      } catch (error) {
        note.textContent = error.message || "Şifre güncellenemedi.";
      }
    };
    const desk = window.deutschaiDesktop;
    const status = document.querySelector("#profile-gemini-status");
    desk.geminiKeyStatus().then(state => {
      status.textContent = state.shared ? "Ortak anahtar açık. Sesli öğretmen ve dersler hazır." : "Ortak anahtar henüz yok.";
    }).catch(error => { status.textContent = error.message || "Anahtar durumu okunamadı."; });
  }

  function zeroPage() {
    localStorage.setItem("deutschai-learn-path", "zero");
    const index = stepIndex();
    const step = ZERO_STEPS[index];
    shell("Sıfırdan Almanca", `
      <section class="card"><h2>Adım ${index + 1}. ${escapeHtml(step.title)}</h2><p>${escapeHtml(step.focus)}</p><div class="example"><b>${escapeHtml(step.de)}</b><span>${escapeHtml(step.tr)}</span></div><div class="settings-row"><button class="btn" id="zero-teach" type="button">Felkan bu adımı anlatsın</button><button class="btn ghost" id="zero-live" type="button">Sesli çalış</button><button class="btn ghost" type="button" onclick="setPage('profile')">Profil'e dön</button></div><p id="zero-status" class="muted"></p><div id="zero-lesson"></div></section>
      <ol class="learner-steps">${ZERO_STEPS.map((item, itemIndex) => `<li class="${itemIndex === index ? "is-current" : ""} ${itemIndex < index ? "is-done" : ""}"><button type="button" data-step="${itemIndex}"><b>${itemIndex + 1}. ${escapeHtml(item.title)}</b><small>${escapeHtml(item.focus)}</small></button></li>`).join("")}</ol>
      <section class="card"><h2>Bu bölümde yapay zekâya verilen tam yönerge</h2><p class="muted">Felkan burada öğrenciyi hiç Almanca bilmiyor kabul eder ve sırayı bozmaz.</p>${promptBlock(window.deutschaiTeacherBrief())}</section>`);
    document.querySelectorAll("[data-step]").forEach(button => button.onclick = () => { localStorage.setItem("deutschai-zero-step", button.dataset.step); zeroPage(); });
    document.querySelector("#zero-live").onclick = () => setPage("live");
    document.querySelector("#zero-teach").onclick = async () => {
      const status = document.querySelector("#zero-status");
      const box = document.querySelector("#zero-lesson");
      status.textContent = "Felkan bu adımı hazırlıyor…";
      try {
        const lesson = await window.deutschaiDesktop.supabaseTutor({
          task: "zeroLesson",
          text: `Sıfırdan Almanca, adım ${index + 1}: ${step.title}. Odak: ${step.focus}. JSON şeması: {"title":"","explanationTr":"","examples":[{"de":"","tr":""}],"practice":[{"prompt":"","answer":""}],"sayAloud":""}. explanationTr en fazla 90 kelime. examples tam 3. practice tam 2. sayAloud öğrencinin tekrar edeceği tek Almanca cümle.`
        });
        const examples = Array.isArray(lesson.examples) ? lesson.examples : [];
        const practice = Array.isArray(lesson.practice) ? lesson.practice : [];
        box.innerHTML = `<h3>${escapeHtml(lesson.title || step.title)}</h3><p>${escapeHtml(lesson.explanationTr || "")}</p>${examples.map(item => `<div class="example"><b>${escapeHtml(item.de || "")}</b><span>${escapeHtml(item.tr || "")}</span></div>`).join("")}<p><b>Birlikte söyle:</b> ${escapeHtml(lesson.sayAloud || step.de)}</p>${practice.map(item => `<p class="muted">${escapeHtml(item.prompt || "")} · ${escapeHtml(item.answer || "")}</p>`).join("")}`;
        status.textContent = index < ZERO_STEPS.length - 1 ? "Adım hazır. Sıradakine geçebilirsin." : "Son adımdasın. Sesli çalışmayla konuşmayı dene.";
        if (index < ZERO_STEPS.length - 1) localStorage.setItem("deutschai-zero-step", String(index));
      } catch (error) {
        status.textContent = error.message || "Ders hazırlanamadı.";
        box.innerHTML = `<p>Anahtar yoksa bu adımı yine de çalış: <b>${escapeHtml(step.de)}</b> — ${escapeHtml(step.tr)}</p>`;
      }
    };
  }

  window.deutschaiRenderLearnerPage = pageName => {
    if (pageName === "zero") return zeroPage();
    if (pageName === "admin") return adminPage();
    return profilePage();
  };

  function adminPage() {
    const access = learner().access?.() || {};
    if (access.role !== "admin") { setPage("home"); return; }
    shell("Yönetim", `
      <section class="card learner-settings"><h2>Ortak Gemini anahtarı</h2><p>Bu anahtarı bir kez kaydet. Bu tarayıcıdaki bütün hesaplar sesli öğretmeni ve üretilen dersleri bununla açar. Öğrenciler anahtar girmez.</p><p class="muted">Anahtar site dosyasına ve GitHub'a yazılmaz. Başka bir telefon bu tarayıcının kaydını görmez; o telefonda da yönetici hesabıyla bir kez kaydetmen gerekir.</p><p id="admin-key-status" class="muted">Durum kontrol ediliyor…</p><form id="admin-key-form" class="learner-custom"><span>API anahtarı</span><input id="admin-key-input" type="password" autocomplete="off" minlength="20" placeholder="Gemini API anahtarı" required><div class="settings-row"><button class="btn" type="submit">Anahtarı kaydet</button><button class="btn ghost" id="admin-key-remove" type="button">Kaldır</button></div></form></section>`);
    const desk = window.deutschaiDesktop;
    const status = document.querySelector("#admin-key-status");
    desk.geminiKeyStatus().then(state => {
      status.textContent = state.shared ? "Ortak anahtar kayıtlı. Bütün hesaplar bunu kullanıyor." : "Henüz ortak anahtar yok.";
    }).catch(error => { status.textContent = error.message || "Durum okunamadı."; });
    document.querySelector("#admin-key-form").onsubmit = async event => {
      event.preventDefault();
      const input = document.querySelector("#admin-key-input");
      status.textContent = "Anahtar kaydediliyor…";
      try {
        await desk.sharedGeminiSave(input.value);
        input.value = "";
        status.textContent = "Kaydedildi. Bu tarayıcıdaki bütün hesaplar bu anahtarı kullanır.";
      } catch (error) {
        status.textContent = error.message || "Anahtar kaydedilemedi.";
      }
    };
    document.querySelector("#admin-key-remove").onclick = async () => {
      try {
        await desk.sharedGeminiRemove();
        status.textContent = "Ortak anahtar kaldırıldı.";
      } catch (error) {
        status.textContent = error.message || "Anahtar kaldırılamadı.";
      }
    };
  }

  const style = document.createElement("style");
  style.textContent = ".learner-level{display:grid;gap:8px;margin:0 0 16px;padding:22px;border-radius:20px;background:linear-gradient(120deg,#102f44,#2b194b);color:#f4fbff}.learner-level span{font-size:11px;letter-spacing:.14em;font-weight:800;color:#7ee7ea}.learner-level strong{font-size:42px;letter-spacing:-1px}.learner-level p{margin:0;color:#c5d4ea;max-width:640px}.learner-goals{display:flex;flex-wrap:wrap;gap:8px}.goal-chip{border:1px solid var(--line);border-radius:999px;padding:8px 12px;background:transparent;color:var(--ink)}.goal-chip.is-on{background:var(--green);color:#fff;border-color:transparent}.learner-custom{display:grid;gap:6px;margin:14px 0;font-size:13px;font-weight:700}.learner-prompt{white-space:pre-wrap;overflow:auto;max-width:100%;padding:14px;border-radius:14px;background:#071225;color:#d7e6ff;font:13px/1.6 ui-monospace,Consolas,monospace}.learner-steps{display:grid;gap:8px;margin:16px 0;padding:0;list-style:none}.learner-steps button{width:100%;text-align:left;border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--paper);color:var(--ink)}.learner-steps .is-current button{border-color:var(--green)}.learner-steps small{display:block;color:var(--muted);font-weight:500}.learner-skills{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}.learner-skills article{padding:12px;border:1px solid var(--line);border-radius:12px}.learner-skills strong{display:block;font-size:20px}.learner-identity{display:grid;gap:4px;margin:0 0 12px}.learner-identity span{color:var(--muted)}.learner-settings .theme-swatches{margin:8px 0 14px}.learner-settings .learner-custom input{width:100%}@media(max-width:820px){.learner-level strong{font-size:34px}.learner-custom input,.learner-custom select{width:100%}}#learner-shortcuts{display:none}@media(min-width:821px){body.student-assistant-mode #learner-shortcuts{position:fixed;z-index:45;top:16px;left:16px;display:flex;gap:8px}#learner-shortcuts button{border:1px solid #24436d;border-radius:10px;padding:8px 12px;background:#07152bd9;color:#d7e7ff}}";
  document.head.appendChild(style);
  const previousRender = render;
  render = function () {
    previousRender();
    const bar = document.querySelector("#learner-shortcuts");
    if (!document.body.classList.contains("student-assistant-mode")) { bar?.remove(); return; }
    if (bar) return;
    const shortcuts = document.createElement("div");
    shortcuts.id = "learner-shortcuts";
    shortcuts.innerHTML = '<button type="button" onclick="setPage(\'profile\')">Profil</button><button type="button" onclick="setPage(\'zero\')">Sıfırdan</button>';
    document.body.appendChild(shortcuts);
  };
})();
