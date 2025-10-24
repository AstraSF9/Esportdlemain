// public/auth.js
const $ = (sel) => document.querySelector(sel);

/*
const api = (path) => `http://localhost:3000${path}`;
*/

// Usa same-origin por defecto; si algún día hosteás el front aparte,
// podés definir window.API_URL en un <script> para apuntar al backend.
const API_BASE = (window.API_URL || "").replace(/\/+$/, "");
const api = (path) => `${API_BASE}${path}`;


/* ==============  i18n (ES/EN)  ============== */
const I18N = {
  es: {
    // navbar / auth
    sign_in: 'Iniciar sesión',
    sign_up: 'Registrarse',
    login_tab: 'Ingresar',
    register_tab: 'Registrarse',
    user_or_email: 'Usuario o Email',
    password: 'Contraseña',
    enter: 'Entrar',
    create_account: 'Crear cuenta',
    hello: 'Hola',
    my_account: 'Mi cuenta',
    logout: 'Salir',
    // account modal
    account_title: 'Tu cuenta',
    today_player: 'Hoy (Jugador)',
    today_team: 'Hoy (Equipo)',
    days_done: 'Días completados',
    streak: 'Racha actual',
    account_tip_full: '¡Completaste los dos desafíos de hoy!',
    account_tip_partial: 'Tip: completar cualquiera de los dos suma para la racha.',
    // index
    mode_player_title: 'Modo Jugador',
    mode_player_sub: 'Adiviná al jugador del día',
    mode_team_title: 'Modo Equipo',
    mode_team_sub: 'Adiviná el equipo del día',
    play_btn: 'Jugar',
    // daily
    challenge_of: 'Desafío del',
    letters_n: (n) => `Tiene ${n} letras`,
    hints_title: 'Pistas',
    your_guess: 'Tu intento',
    try_btn: 'Probar',
    checking: 'Comprobando...',
    correct: '¡Correcto! 🎉',
    incorrect_reveal: 'Incorrecto, se revela una pista…',
    no_more_hints: 'Ya no hay mas pistas... se valiente',
    region_label: 'Región',
    // hint labels
    hint_nat: 'Nacionalidad',
    hint_age: 'Edad',
    hint_progame: 'Juego profesional',
    hint_firstteam: 'Primer equipo',
    hint_currentteam: 'Equipo actual',
    hint_region: 'Región',
    hint_founded: 'Año de fundación',
    hint_games: 'Juegos',
    // not-found
    player_not_found: (name) => `El jugador "${name}" no existe o no ha sido agregado a la base de datos`,
    team_not_found:   (name) => `El equipo "${name}" no existe o no ha sido agregado a la base de datos`,
    // language toggle
    lang_toggle: (cur) => (cur === 'es' ? 'EN' : 'ES'),
    // admin
    admin: 'Admin',
    admin_panel: 'Panel de Administrador',
    admin_today: 'Selección del día',
    admin_player: 'Jugador del día',
    admin_team: 'Equipo del día',
    admin_save: 'Guardar cambios',
    admin_stats_title: 'Estadísticas de hoy',
    admin_stats_players: 'Usuarios que intentaron (Jugador)',
    admin_stats_teams: 'Usuarios que intentaron (Equipo)',
    admin_success: 'Actualizado correctamente',
    admin_error: 'No se pudo actualizar'
  },
  en: {
    sign_in: 'Sign in',
    sign_up: 'Sign up',
    login_tab: 'Sign in',
    register_tab: 'Register',
    user_or_email: 'Username or Email',
    password: 'Password',
    enter: 'Enter',
    create_account: 'Create account',
    hello: 'Hi',
    my_account: 'My account',
    logout: 'Log out',
    // account modal
    account_title: 'Your account',
    today_player: 'Today (Player)',
    today_team: 'Today (Team)',
    days_done: 'Days completed',
    streak: 'Current streak',
    account_tip_full: 'You completed both of today’s challenges!',
    account_tip_partial: 'Tip: either challenge counts toward your streak.',
    // index
    mode_player_title: 'Player Mode',
    mode_player_sub: 'Guess today’s player',
    mode_team_title: 'Team Mode',
    mode_team_sub: 'Guess today’s team',
    play_btn: 'Play',
    // daily
    challenge_of: 'Challenge of',
    letters_n: (n) => `It has ${n} letters`,
    hints_title: 'Hints',
    your_guess: 'Your guess',
    try_btn: 'Try',
    checking: 'Checking...',
    correct: 'Correct! 🎉',
    incorrect_reveal: 'Wrong, revealing a hint…',
    no_more_hints: 'No more hints… be brave',
    region_label: 'Region',
    // hint labels
    hint_nat: 'Nationality',
    hint_age: 'Age',
    hint_progame: 'Pro game',
    hint_firstteam: 'First team',
    hint_currentteam: 'Current team',
    hint_region: 'Region',
    hint_founded: 'Founded',
    hint_games: 'Games',
    // not-found
    player_not_found: (name) => `Player "${name}" does not exist or hasn't been added to the database`,
    team_not_found:   (name) => `Team "${name}" does not exist or hasn't been added to the database`,
    // language toggle
    lang_toggle: (cur) => (cur === 'en' ? 'ES' : 'EN'),
    // admin
    admin: 'Admin',
    admin_panel: 'Admin Panel',
    admin_today: 'Today’s selection',
    admin_player: 'Player of the day',
    admin_team: 'Team of the day',
    admin_save: 'Save changes',
    admin_stats_title: 'Today’s stats',
    admin_stats_players: 'Users who attempted (Player)',
    admin_stats_teams: 'Users who attempted (Team)',
    admin_success: 'Updated successfully',
    admin_error: 'Could not update'
  }
};
function getLang(){ return localStorage.getItem('esportdle_lang') || 'es'; }
function t(key, ...args){
  const lang = getLang();
  const v = I18N[lang][key];
  return typeof v === 'function' ? v(...args) : (v ?? key);
}
function setLang(lang){
  localStorage.setItem('esportdle_lang', lang);
  applyTranslations();
  renderUser();
  window.dispatchEvent(new Event('esportdle:langchange'));
}
function toggleLang(){ setLang(getLang()==='es' ? 'en' : 'es'); }

/* traducir elementos con data-i18n */
function applyTranslations(){
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key, ...(el.dataset.args ? JSON.parse(el.dataset.args) : []));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });
  const langBtn = document.getElementById('langToggle');
  if (langBtn) langBtn.textContent = t('lang_toggle', getLang());
}

/* ======= Auth modals ======= */
function openModal(){ document.getElementById('authModal')?.classList.remove('hidden'); }
function closeModal(){ document.getElementById('authModal')?.classList.add('hidden'); }
function setActiveTab(id){
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab===id));
  document.querySelectorAll('.tabpanel').forEach(p => p.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}

/* ======= Account helpers ======= */
function saveSession({ token, user }){
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_user', JSON.stringify(user));
  renderUser();
  window.dispatchEvent(new CustomEvent('esportdle:login', { detail: user }));
}
function token(){ return localStorage.getItem('auth_token') || ''; }
function isAdmin(){
  const u = JSON.parse(localStorage.getItem('auth_user') || 'null');
  const tok = token();
  return (u && u.role === 'admin') || tok === 'admin-fixed-token';
}

async function openAccountModal(){
  document.getElementById('accountModal')?.classList.remove('hidden');
  await loadAccountSummary();
}
function closeAccountModal(){ document.getElementById('accountModal')?.classList.add('hidden'); }

async function loadAccountSummary(){
  const u = JSON.parse(localStorage.getItem('auth_user') || 'null');
  const hello = document.getElementById('accountHello');
  if (hello && u) hello.textContent = `${t('hello')}, ${u.username}${u.email ? ' · ' + u.email : ''}`;

  const note = document.getElementById('acc_note');
  try{
    const r = await fetch(api('/api/account/summary'), { headers: { 'Authorization': `Bearer ${token()}` }});
    const d = await r.json();
    if(!d.ok) throw new Error(d.error || 'Error');

    document.getElementById('acc_today_player')?.replaceChildren(document.createTextNode(d.today.player_done ? '✔' : '—'));
    document.getElementById('acc_today_team')?.replaceChildren(document.createTextNode(d.today.team_done ? '✔' : '—'));
    document.getElementById('acc_days_total')?.replaceChildren(document.createTextNode(d.stats.days_played));
    document.getElementById('acc_streak')?.replaceChildren(document.createTextNode(d.stats.streak));

    if (note) note.textContent = d.today.player_done && d.today.team_done ? t('account_tip_full') : t('account_tip_partial');
  }catch(e){
    if (note) note.textContent = e.message;
  }
}

/* ======= Admin Modal ======= */
function ensureAdminModal(){
  if (document.getElementById('adminModal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'adminModal';
  wrap.className = 'modal hidden';
  wrap.innerHTML = `
  <div class="modal-box">
    <div class="modal-header">
      <h3 data-i18n="admin_panel">${t('admin_panel')}</h3>
      <button id="closeAdmin" class="btn">✕</button>
    </div>
    <div class="modal-body">
      <section>
        <h4 data-i18n="admin_today">${t('admin_today')}</h4>
        <div id="adminToday"></div>
      </section>
      <section style="margin-top:12px">
        <label><b data-i18n="admin_player">${t('admin_player')}</b></label>
        <select id="adminPlayerSel"></select>
        <label style="margin-left:8px"><b data-i18n="admin_team">${t('admin_team')}</b></label>
        <select id="adminTeamSel"></select>
        <button id="adminSave" class="btn" style="margin-left:8px" data-i18n="admin_save">${t('admin_save')}</button>
        <span id="adminMsg" style="margin-left:8px"></span>
      </section>
      <section style="margin-top:16px">
        <h4 data-i18n="admin_stats_title">${t('admin_stats_title')}</h4>
        <div id="adminStats"></div>
      </section>
    </div>
  </div>`;
  document.body.appendChild(wrap);

  document.getElementById('closeAdmin').onclick = () => wrap.classList.add('hidden');
  wrap.addEventListener('click', (e)=>{ if(e.target.id==='adminModal') wrap.classList.add('hidden'); });
}
function openAdminModal(){
  ensureAdminModal();
  const mod = document.getElementById('adminModal');
  mod.classList.remove('hidden');
  loadAdminData();
}
async function loadAdminData(){
  const msg = $('#adminMsg'); if (msg) msg.textContent = '';
  try{
    const [metaR, playersR, teamsR, statsR] = await Promise.all([
      fetch(api('/api/admin/daily/meta'), { headers: { 'Authorization': `Bearer ${token()}` }}),
      fetch(api('/api/admin/players'),    { headers: { 'Authorization': `Bearer ${token()}` }}),
      fetch(api('/api/admin/teams'),      { headers: { 'Authorization': `Bearer ${token()}` }}),
      fetch(api('/api/admin/stats/today'),{ headers: { 'Authorization': `Bearer ${token()}` }})
    ]);
    const meta  = await metaR.json();
    const pls   = await playersR.json();
    const tms   = await teamsR.json();
    const stats = await statsR.json();

    if (!meta.ok) throw new Error(meta.error || 'meta error');
    if (!pls.ok) throw new Error(pls.error || 'players error');
    if (!tms.ok) throw new Error(tms.error || 'teams error');
    if (!stats.ok) throw new Error(stats.error || 'stats error');

    $('#adminToday').innerHTML =
      `<div>${t('today_player')}: <b>${meta.player?.nombre || '-'}</b> (ID ${meta.player?.id ?? '-'})</div>
       <div>${t('today_team')}: <b>${meta.team?.nombre || '-'}</b> (ID ${meta.team?.id ?? '-'})</div>
       <div>${t('challenge_of')}: ${meta.date}</div>`;

    const selP = $('#adminPlayerSel'); selP.innerHTML = '';
    pls.items.forEach(it => {
      const o = document.createElement('option');
      o.value = it.id; o.textContent = `${it.nombre} (ID ${it.id})`;
      if (meta.player && it.id === meta.player.id) o.selected = true;
      selP.appendChild(o);
    });

    const selT = $('#adminTeamSel'); selT.innerHTML = '';
    tms.items.forEach(it => {
      const o = document.createElement('option');
      o.value = it.id; o.textContent = `${it.nombre} (ID ${it.id})`;
      if (meta.team && it.id === meta.team.id) o.selected = true;
      selT.appendChild(o);
    });

    $('#adminStats').innerHTML =
      `<div>• ${t('admin_stats_players')}: <b>${stats.today.players}</b></div>
       <div>• ${t('admin_stats_teams')}: <b>${stats.today.teams}</b></div>`;

    $('#adminSave').onclick = async () => {
      const body = {
        jugadorId: Number(selP.value) || undefined,
        equipoId:  Number(selT.value) || undefined
      };
      $('#adminMsg').textContent = t('checking');
      try{
        const r = await fetch(api('/api/admin/daily/set'), {
          method: 'POST',
          headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token()}` },
          body: JSON.stringify(body)
        });
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || 'error');
        $('#adminMsg').textContent = t('admin_success');
        await loadAdminData();
      }catch(e){
        $('#adminMsg').textContent = t('admin_error');
      }
    };

  }catch(e){
    if (msg) msg.textContent = e.message;
  }
}

/* ======= Navbar ======= */
function renderUser(){
  const user = JSON.parse(localStorage.getItem('auth_user') || 'null');
  const nav = document.querySelector('.navbar nav');
  if (!nav) return;

  if (user){
    nav.innerHTML = `
      <span>${t('hello')}, <b>${user.username}</b></span>
      <button id="btnAccount" class="btn" data-i18n="my_account">${t('my_account')}</button>
      ${isAdmin() ? `<button id="btnAdmin" class="btn" data-i18n="admin">${t('admin')}</button>` : ''}
      <button id="btnLogout" class="btn" data-i18n="logout">${t('logout')}</button>
      <button id="langToggle" class="btn">${t('lang_toggle', getLang())}</button>
    `;
    document.getElementById('btnLogout').onclick = () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      renderUser();
      window.dispatchEvent(new Event('esportdle:logout'));
    };
    document.getElementById('btnAccount').onclick = openAccountModal;
    if (isAdmin()) document.getElementById('btnAdmin').onclick = openAdminModal;
  } else {
    nav.innerHTML = `
      <button id="btnLogin" class="btn" data-i18n="sign_in">${t('sign_in')}</button>
      <button id="langToggle" class="btn">${t('lang_toggle', getLang())}</button>
    `;
    document.getElementById('btnLogin').onclick = openModal;
  }
  document.getElementById('langToggle')?.addEventListener('click', toggleLang);
}

/* ======= Boot ======= */
window.addEventListener('DOMContentLoaded', () => {
  applyTranslations();
  renderUser();

  // auth modal
  document.getElementById('closeAuth')?.addEventListener('click', () => closeModal());
  document.getElementById('authModal')?.addEventListener('click', (e)=>{ if(e.target.id==='authModal') closeModal(); });

  // account modal
  document.getElementById('closeAccount')?.addEventListener('click', () => closeAccountModal());
  document.getElementById('accountModal')?.addEventListener('click', (e)=>{ if(e.target.id==='accountModal') closeAccountModal(); });

  // tabs
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click',()=> setActiveTab(btn.dataset.tab));
  });

  // login normal + fallback admin
  document.getElementById('formLogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('loginMsg').textContent = t('checking');
    const fd = new FormData(e.target);
    const payload = { emailOrUser: fd.get('emailOrUser').trim(), password: fd.get('password') };

    async function doAdminFallback(){
      try{
        const r2 = await fetch(api('/api/auth/admin'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const d2 = await r2.json();
        if (!d2.ok) throw new Error(d2.error || 'Error');
        saveSession(d2);
        document.getElementById('loginMsg').textContent = 'OK';
        closeModal();
      }catch(err2){
        document.getElementById('loginMsg').textContent = err2.message;
      }
    }

    try{
      const r = await fetch(api('/api/auth/login'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await r.json();
      if(!data.ok) throw new Error(data.error || 'Error');
      saveSession(data);
      document.getElementById('loginMsg').textContent = 'OK';
      closeModal();
    }catch(_){
      await doAdminFallback();
    }
  });

  // register
  document.getElementById('formRegister')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('registerMsg').textContent = t('checking');
    const fd = new FormData(e.target);
    const payload = { username: fd.get('username').trim(), email: fd.get('email').trim(), password: fd.get('password') };
    try{
      const r = await fetch(api('/api/auth/register'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await r.json();
      if(!data.ok) throw new Error(data.error || 'Error');
      saveSession(data);
      document.getElementById('registerMsg').textContent = 'OK';
      closeModal();
    }catch(err){ document.getElementById('registerMsg').textContent = err.message; }
  });

  // Guard: abrir login si no hay sesión al intentar jugar
  document.addEventListener('click', (e) => {
    const logged = !!localStorage.getItem('auth_token');
    if (logged) return;
    const el = e.target.closest('a, .mode-card');
    if (!el) return;

    let wantsGame = false;
    if (el.matches('a')) {
      const href = el.getAttribute('href') || '';
      wantsGame = /adivinar(jugador|equipo)\.html$/i.test(href);
    } else if (el.classList.contains('mode-card')) {
      wantsGame = true;
    }
    if (wantsGame) {
      e.preventDefault(); e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      openModal();
      const msg = document.getElementById('loginMsg');
      if (msg) msg.textContent = getLang()==='es'
        ? 'Bienvenido a Esportdle. Iniciá sesión o registrate para jugar.'
        : 'Welcome to Esportdle. Sign in or register to play.';
    }
  }, true);
});

// Exponer helpers globales
window.t = t;
window.getLang = getLang;
window.setLang = setLang;
window.openAuthModal = openModal;
window.isLoggedIn    = () => !!localStorage.getItem('auth_token');

// === Utilidades comunes ===
/*
const API_BASE = ""; // mismo origen
*/

function getToken() {
  return localStorage.getItem("auth_token") || "";
}
function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function saveUser(u) {
  // guarda todo el user, incluido el role
  localStorage.setItem("auth_user", JSON.stringify(u || {}));
}
function readUser() {
  try { return JSON.parse(localStorage.getItem("auth_user") || "{}"); }
  catch { return {}; }
}

// === Hidratar role desde /api/auth/me ===
async function refreshUserFromBackend() {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/api/auth/me`, { headers: { ...authHeader() } });
    const j = await r.json();
    if (j && j.ok && j.user) {
      saveUser(j.user);
      renderAdminBtn(j.user);
      return j.user;
    }
  } catch (e) {
    console.warn("No se pudo hidratar el perfil:", e);
  }
  return null;
}

// === Mostrar / ocultar botón Admin según role ===
function renderAdminBtn(user) {
  const u = user || readUser();
  const btn = document.querySelector("#adminOpenBtn");    // el botón que abre tu modal admin
  const navItem = document.querySelector("#adminNavItem"); // contenedor opcional en navbar (si lo tienes)
  const show = !!u && u.role === "admin";
  if (btn) btn.style.display = show ? "" : "none";
  if (navItem) navItem.style.display = show ? "" : "none";
}

// === Hook: al cargar la página, si tengo token, hidrato y pinto ===
document.addEventListener("DOMContentLoaded", () => {
  // intenta hidratar el usuario (trae role) y pinta admin
  refreshUserFromBackend().then(() => renderAdminBtn());
});

// === Hook: después de un login exitoso, vuelve a hidratar ===
// Si tu código de login tiene una función que guarda el token, llama a:
window.__afterLogin = async function() {
  await refreshUserFromBackend();
};

/* ================================
   PATCH GLOBAL AUTH / ADMIN (APPEND-ONLY)
   ================================ */

// 1) Parche fetch para /api/*
if (!window.__AUTH_FETCH_PATCHED) {
  window.__AUTH_FETCH_PATCHED = true;
  (function () {
    const _origFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      try {
        const url = (typeof input === "string") ? input : (input?.url || "");
        const isApi = /^\/api\//.test(url);
        if (!isApi) return _origFetch(input, init);

        const headers = new Headers(init.headers || {});
        if (!headers.has("Authorization")) {
          const t = localStorage.getItem("auth_token") || "";
          if (t) headers.set("Authorization", `Bearer ${t}`);
        }
        return _origFetch(input, { ...init, headers });
      } catch {
        return _origFetch(input, init);
      }
    };

    // helper opcional
    window.apiFetch = async (url, opts = {}) => {
      const headers = new Headers(opts.headers || {});
      if (!headers.has("Authorization")) {
        const t = localStorage.getItem("auth_token") || "";
        if (t) headers.set("Authorization", `Bearer ${t}`);
      }
      return fetch(url, { ...opts, headers });
    };
  })();
}

// 2) Envolver saveSession (si no lo envolvimos ya)
(function () {
  if (typeof window.saveSession === "function" && !window.saveSession.__wrapped) {
    const _old = window.saveSession;
    const wrapped = function (p) {
      try { _old(p); } catch {}
      if (typeof window.refreshUserFromBackend === "function") {
        window.refreshUserFromBackend().then(() => {
          try { if (typeof window.renderUser === "function") window.renderUser(); } catch {}
        });
      }
    };
    wrapped.__wrapped = true;
    window.saveSession = wrapped;
  }
})();

// 3) Refuerzo del botón Admin (por si el render condicional tarda)
document.addEventListener("DOMContentLoaded", () => {
  try { if (typeof window.renderAdminBtn === "function") window.renderAdminBtn(); } catch {}
});
