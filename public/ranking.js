// ranking.js (con podio, guard de login y i18n)
(function(){
  const API = "";
  const $ = (s, r=document) => r.querySelector(s);

  function lang(){ return (localStorage.getItem("esportdle_lang") || "es").toLowerCase(); }
  const STR = {
    es: {
      title: "🏆 Ranking global",
      back: "← Volver",
      byStreak: "Ordenar por racha",
      byDays: "Ordenar por días completados",
      user: "Usuario",
      streak: "Racha",
      days: "Días completados",
      loading: "Cargando…",
      empty: "Sin datos para mostrar.",
      podioStreak: (n) => `Racha: ${n}`,
      podioDays: (n) => `Días completados: ${n}`,
      mustLogin: "Debés iniciar sesión para ver el ranking."
    },
    en: {
      title: "🏆 Global ranking",
      back: "← Back",
      byStreak: "Sort by streak",
      byDays: "Sort by completed days",
      user: "User",
      streak: "Streak",
      days: "Completed days",
      loading: "Loading…",
      empty: "No data available.",
      podioStreak: (n) => `Streak: ${n}`,
      podioDays: (n) => `Completed days: ${n}`,
      mustLogin: "You must sign in to view the ranking."
    }
  };

  let sortMode = "streak"; // 'streak' | 'days'
  let page = 0;
  const pageSize = 50;

  // ==== helpers auth ====
  function token(){ return localStorage.getItem("auth_token") || ""; }
  function isLoggedIn(){
    const t = token();
    return !!t && t.length > 10; // heurística simple; tu auth.js puede exponer window.isLoggedIn()
  }
  function openLogin(){
    if (typeof window.openAuthModal === "function") window.openAuthModal();
  }

  function t(k){ return STR[lang()][k]; }

  function applyI18n(){
    $("#rkTitle").textContent = t("title");
    $("#rkBack").textContent = t("back");
    $("#btnSortStreak").textContent = t("byStreak");
    $("#btnSortDays").textContent = t("byDays");
    $("#thUser").textContent = t("user");
    $("#thStreak").textContent = t("streak");
    $("#thDays").textContent = t("days");

    // re-traducir podio si ya hay datos
    for (const id of ["P1","P2","P3"]){
      const s = $(`#rk${id}Streak`), d = $(`#rk${id}Days`);
      if (s?.dataset.v) s.textContent = STR[lang()].podioStreak(s.dataset.v);
      if (d?.dataset.v) d.textContent = STR[lang()].podioDays(d.dataset.v);
    }
  }
  function setActive(){
    $("#btnSortStreak").classList.toggle("active", sortMode==="streak");
    $("#btnSortDays").classList.toggle("active", sortMode==="days");
  }
  function escapeHtml(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function paintPodium(items){
    const pod = $("#rkPodium");
    if (!pod) return;

    if (page !== 0 || !items.length) {
      pod.classList.add("rk-empty");
      return;
    }
    pod.classList.remove("rk-empty");

    const setCard = (prefix, it, place) => {
      const card = $(`#${prefix}`); if (!card) return;
      if (!it){ card.style.display = "none"; return; }
      card.style.display = "";
      $(`#${prefix}Name`).textContent = it.username || "—";
      const s = $(`#${prefix}Streak`), d = $(`#${prefix}Days`);
      s.dataset.v = it.streak; d.dataset.v = it.days_completed;
      s.textContent = STR[lang()].podioStreak(it.streak);
      d.textContent = STR[lang()].podioDays(it.days_completed);
      const placeEl = card.querySelector(".rk-card__place");
      if (placeEl) placeEl.textContent = `#${place}`;
    };

    setCard("rkP1", items[0], 1);
    setCard("rkP2", items[1], 2);
    setCard("rkP3", items[2], 3);
  }

  async function load(){
    const tbody = $("#rkTbody");
    tbody.innerHTML = `<tr><td colspan="4" class="rk-empty">${t("loading")}</td></tr>`;

    try{
      const offset = page * pageSize;
      const r = await fetch(
        `${API}/api/ranking?sort=${sortMode}&limit=${pageSize}&offset=${offset}&ts=${Date.now()}`,
        {
          cache: "no-store",
          headers: token() ? { Authorization: `Bearer ${token()}` } : {}
        }
      );

      if (r.status === 401) {
        // no autorizado -> mostrar aviso y pedir login
        $("#rkTbody").innerHTML = `<tr><td colspan="4" class="rk-empty">${t("mustLogin")}</td></tr>`;
        openLogin();
        return;
      }

      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "error");

      paintPodium(j.items);

      if (!j.items.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="rk-empty">${t("empty")}</td></tr>`;
        return;
      }

      const rows = j.items.map((it, idx) => {
        const pos = offset + idx + 1;
        return `<tr>
          <td>${pos}</td>
          <td>${escapeHtml(it.username)}</td>
          <td>${it.streak}</td>
          <td>${it.days_completed}</td>
        </tr>`;
      }).join("");

      tbody.innerHTML = rows;
    }catch(e){
      paintPodium([]); // ocultar podio si hubo error
      $("#rkTbody").innerHTML = `<tr><td colspan="4" class="rk-empty">${t("empty")}</td></tr>`;
    }
  }

  // Cargar solo si hay login; si no, abrir modal y esperar evento de login
  function requireLoginThenLoad(){
    if (!isLoggedIn()) {
      $("#rkTbody").innerHTML = `<tr><td colspan="4" class="rk-empty">${t("mustLogin")}</td></tr>`;
      openLogin();
      // cuando inicie sesión, recargamos ranking una vez
      window.addEventListener("esportdle:login", () => load(), { once: true });
      return;
    }
    load();
  }

  // Listeners
  $("#btnSortStreak").addEventListener("click", () => { sortMode="streak"; page=0; setActive(); requireLoginThenLoad(); });
  $("#btnSortDays").addEventListener("click", () => { sortMode="days"; page=0; setActive(); requireLoginThenLoad(); });
  $("#btnPrev").addEventListener("click", () => { if (page>0){ page--; requireLoginThenLoad(); } });
  $("#btnNext").addEventListener("click", () => { page++; requireLoginThenLoad(); });

  window.addEventListener("esportdle:langchange", () => { applyI18n(); requireLoginThenLoad(); });

  window.addEventListener("DOMContentLoaded", () => { applyI18n(); setActive(); requireLoginThenLoad(); });
})();
