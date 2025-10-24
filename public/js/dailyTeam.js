// --- dailyTeam.js ---
// Meta + pistas progresivas para Equipo (i18n, anticache y lock SOLO en memoria)
(function () {
  const API = "";
  const $ = (sel) => document.querySelector(sel);

  function lang(){ return (localStorage.getItem("esportdle_lang") || "es").toLowerCase(); }
  const STR = {
    es: {
      challenge_of: "Desafío del",
      it_has_letters_s: "Tiene {n} letra",
      it_has_letters_p: "Tiene {n} letras",
      hints_title: "Pistas",
      no_more_hints: "Ya no hay más pistas… sé valiente",
      not_found: (name) => `El equipo "${name}" no existe o no ha sido agregado a la base de datos`,
      correct: "¡Correcto!",
      wrong: "Incorrecto",
      already_done: "Ya resolviste el equipo de hoy (no suma de nuevo).",
      must_login: "Debés iniciar sesión para jugar."
    },
    en: {
      challenge_of: "Challenge of",
      it_has_letters_s: "It has {n} letter",
      it_has_letters_p: "It has {n} letters",
      hints_title: "Hints",
      no_more_hints: "No more hints… be brave",
      not_found: (name) => `The team "${name}" doesn't exist or hasn't been added to the database`,
      correct: "Correct!",
      wrong: "Wrong",
      already_done: "You already solved today's team (won't count again).",
      must_login: "You must sign in to play."
    },
  };
  const T = (k) => STR[lang()][k];

  let META = null;
  let revealed = 0;
  let locked = false;
  let lastStatus = null; // "correct" | "wrong" | "already_done" | null

  const elDate = $("#teamDate");
  const elLetters = $("#teamHint");
  const elHintsBlock = $("#teamHintsBlock");
  const elHintsTitle = $("#teamHintsTitle");
  const elHintsList = $("#teamHintsList");
  const elMsg = $("#teamMsg");
  const elForm = $("#formGuessTeam");
  const elInput = $("#guessTeam");

  /* ===== Overlay Buscador Equipos (prefijo) ===== */
(() => {
  elInput.setAttribute("autocomplete","off");
  elInput.setAttribute("autocorrect","off");
  elInput.setAttribute("autocapitalize","off");
  elInput.setAttribute("spellcheck","false");
  elInput.removeAttribute("list");
  elInput.removeAttribute("title");

  const overlay = document.createElement("div");
  overlay.className = "search-overlay";
  overlay.innerHTML = `
    <div class="search-panel">
      <div class="search-head">
        <input id="searchTeamBox" class="search-input" placeholder="Buscar equipo..." />
        <button id="searchTeamClose" class="search-close">✕</button>
      </div>
      <div id="searchTeamList" class="search-list"></div>
    </div>`;
  document.body.appendChild(overlay);

  const box   = overlay.querySelector("#searchTeamBox");
  const list  = overlay.querySelector("#searchTeamList");
  const btnX  = overlay.querySelector("#searchTeamClose");
  let timer = null, items = [], idx = -1;

  function openOverlay() {
    overlay.style.display = "block";
    box.value = (elInput.value || "");
    box.focus(); box.select();
    searchNow();
  }
  function closeOverlay() { overlay.style.display = "none"; }

  async function fetchTeamsPrefix(q) {
    try{
      const r = await fetch(`/api/browse/teams?q=${encodeURIComponent(q||"")}&ts=${Date.now()}`, {
        headers: { ...authHeader() }, cache:"no-store"
      });
      const j = await r.json();
      return j?.ok ? (j.items||[]) : [];
    }catch{ return []; }
  }

  const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
                            .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

  function render() {
    list.innerHTML = "";
    if (!items.length) { list.innerHTML = `<div class="search-item" style="justify-content:center;color:#9ca3af">Sin resultados</div>`; return; }
    items.forEach((it, i) => {
      const initial = (it.name||"?").trim().charAt(0).toUpperCase();
      const div = document.createElement("div");
      div.className = "search-item";
      div.innerHTML = `
        <div class="search-avatar">${initial}</div>
        <div class="search-name">${esc(it.name)}</div>
      `;
      div.addEventListener("mousedown", (ev) => { ev.preventDefault(); selectIndex(i); });
      list.appendChild(div);
    });
    highlight();
  }

  function highlight() {
    [...list.children].forEach((n, i) => n.classList.toggle("active", i === idx));
    if (idx >= 0) list.children[idx].scrollIntoView({ block: "nearest" });
  }

  function selectIndex(i) {
    if (i < 0 || i >= items.length) return;
    elInput.value = items[i].name;
    closeOverlay();
  }

  async function searchNow() {
    const q = (box.value || "").trim();
    if (!q) { items = []; idx = -1; render(); return; }
    items = await fetchTeamsPrefix(q);
    idx = items.length ? 0 : -1;
    render();
  }

  function schedule(){ clearTimeout(timer); timer = setTimeout(searchNow, 120); }

  elInput.addEventListener("focus", openOverlay);
  elInput.addEventListener("keydown", ()=>{ if (overlay.style.display !== "block") openOverlay(); });

  box.addEventListener("input", schedule);
  box.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeOverlay(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); if (items.length){ idx = (idx+1)%items.length; highlight(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (items.length){ idx = (idx-1+items.length)%items.length; highlight(); } }
    else if (e.key === "Enter") { e.preventDefault(); if (idx>=0) selectIndex(idx); }
  });

  btnX.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", (e)=>{ if (e.target === overlay) closeOverlay(); });
})();

  function disableUI(){
    locked = true;
    if (elInput) elInput.disabled = true;
    const btn = elForm?.querySelector('button[type="submit"]');
    if (btn) btn.setAttribute('disabled','disabled');
    elInput?.classList.add('disabled');
  }
  function enableUI(){
    locked = false;
    if (elInput) elInput.disabled = false;
    const btn = elForm?.querySelector('button[type="submit"]');
    if (btn) btn.removeAttribute('disabled');
    elInput?.classList.remove('disabled');
  }

  function fmtLetters(n){
    return n === 1 ? T("it_has_letters_s").replace("{n}", n)
                   : T("it_has_letters_p").replace("{n}", n);
  }

  function renderHints(){
    elHintsList.innerHTML = "";
    const hs = META?.hints || [];
    if (!hs.length) { elHintsBlock.classList.add("hidden"); return; }
    for (let i=0;i<Math.min(revealed, hs.length);i++){
      const li = document.createElement("li");
      li.textContent = hs[i];
      elHintsList.appendChild(li);
    }
    elHintsBlock.classList.toggle("hidden", revealed === 0);
    if (revealed >= hs.length){
      const li = document.createElement("li");
      li.style.opacity = 0.85;
      li.textContent = T("no_more_hints");
      elHintsList.appendChild(li);
    }
  }

  function translateLastMsg(){
    if (!lastStatus) { elMsg.textContent = ""; return; }
    elMsg.textContent = T(lastStatus);
  }

  function paintMeta(){
    if (!META) return;
    enableUI();
    elDate.textContent = `${T("challenge_of")} ${META.date}`;
    elLetters.textContent = fmtLetters(META.letters);
    elHintsTitle.textContent = T("hints_title");
    renderHints();
    translateLastMsg();
  }

  async function loadMeta({ preserveRevealed = false } = {}){
    const keep = revealed;
    if (!preserveRevealed) revealed = 0;
    try{
      const r = await fetch(`${API}/api/daily/team/meta?lang=${lang()}&ts=${Date.now()}`, {
        headers: { "Cache-Control": "no-store", ...authHeader() },
        cache: "no-store",
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "meta error");
      META = { date: j.date, letters: j.letters || 0, hints: j.hints || [] };
      if (preserveRevealed) revealed = keep;
      paintMeta();
    }catch(e){
      elMsg.textContent = (e && e.message) || "Error obteniendo meta";
      META = { date: "", letters: 0, hints: [] };
      paintMeta();
    }
  }

  function token(){ return localStorage.getItem("auth_token") || ""; }
  function authHeader(){
    const t = token();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  async function sendGuess(name){
    const body = { guess: name };
    const r = await fetch(`${API}/api/daily/team/guess?ts=${Date.now()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(()=>({}));
    return { status: r.status, data: j };
  }

  function requireLoginPrompt(){
    elMsg.textContent = T('must_login');
    if (typeof window.openAuthModal === 'function') window.openAuthModal();
  }

  elForm?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (locked) return;

    // Guard: si no hay sesión, abrir login y no enviar
    if (!token()) { requireLoginPrompt(); return; }

    const guess = (elInput.value || "").trim();
    if (!guess) return;
    elMsg.textContent = "";
    lastStatus = null;

    try{
      const { status, data } = await sendGuess(guess);

      if (status === 401) { requireLoginPrompt(); return; }

      if (status === 404 && data?.code === "NAME_NOT_FOUND") {
        elMsg.textContent = STR[lang()].not_found(guess);
        return;
      }
      if (!data?.ok) { elMsg.textContent = data?.error || "Error"; return; }

      if (data.already_done) {
        lastStatus = data.correcto ? "already_done" : "wrong";
        translateLastMsg();
        if (!data.correcto) {
          const total = (META?.hints || []).length;
          if (revealed < total) revealed += 1;
          renderHints();
        }
        return;
      }

      if (data.correcto || data.correct === true) {
        lastStatus = "correct";
        translateLastMsg();
        disableUI();
        return;
      }

      lastStatus = "wrong";
      translateLastMsg();
      const total = (META?.hints || []).length;
      if (revealed < total) revealed += 1;
      renderHints();
    }catch{
      elMsg.textContent = "Error enviando intento";
    }
  });

  window.addEventListener('esportdle:logout', () => {
    lastStatus = 'must_login';
    elMsg.textContent = T('must_login');
  });

  window.addEventListener("esportdle:langchange", () => loadMeta({ preserveRevealed: true }));
  window.addEventListener("DOMContentLoaded", () => loadMeta({ preserveRevealed: false }));
})();
