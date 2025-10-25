// servernuevo.js
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");
const runSeed = require("./models/seed");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get('/health', (req, res) => res.status(200).json({ ok: true }));


// ==========================
// Zona horaria de la app
// ==========================
const APP_TZ = process.env.APP_TZ || 'America/Argentina/Buenos_Aires';

// YYYY-MM-DD en la zona deseada (helper que ya habías añadido)
function todayYMD(tz = APP_TZ) {
  const d = new Date();
  const y = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric' }).format(d);
  const m = new Intl.DateTimeFormat('en-CA', { timeZone: tz, month: '2-digit' }).format(d);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz, day: '2-digit' }).format(d);
  return `${y}-${m}-${day}`; // en-CA = YYYY-MM-DD
}

// ==========================
// Rutas de auth (si existen)
// ==========================
try {
  const authRoutes = require("./routes/auth");
  app.use("/api/auth", authRoutes);
} catch (_) {
  // si no existe, seguimos sin romper el server
}

// Ejecutar seed al iniciar (idempotente)
runSeed()
  .then(() => console.log("▶️  Seed ejecutado al iniciar"))
  .catch((err) => console.error("Seed on boot error:", err));

/* =========================
   Helpers DB / selección
   ========================= */
function q(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (e, rows) => (e ? reject(e) : resolve(rows)));
  });
}

// Fecha "YYYY-MM-DD" en TZ (tu helper original)
function todayKey(tz = "America/Argentina/Buenos_Aires") {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}

// Hash -> número en [0, count-1]
function seededOffset(count, seed) {
  if (!count || count <= 0) return 0;
  const h = crypto.createHash("sha256").update(seed).digest();
  const n = h.readUInt32BE(0);
  return n % count;
}

/* =========================
   Auth mínima compatible
   ========================= */
const SECRET =
  process.env.ESPORTDLE_SECRET || "cambia-esta-clave-super-secreta";

function verifyTokenSimple(tokenB64) {
  try {
    const raw = Buffer.from(tokenB64, "base64url").toString();
    const [id, ts, sig] = raw.split(".");
    const base = `${id}.${ts}`;
    const expected = crypto
      .createHmac("sha256", SECRET)
      .update(base)
      .digest("base64url");
    if (sig !== expected) return null;
    return { id: parseInt(id, 10), ts: parseInt(ts, 10) };
  } catch {
    return null;
  }
}
function bearerToUserId(bearer) {
  if (!bearer) return null;
  const token = bearer.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const p = verifyTokenSimple(token);
  return p?.id || null;
}
function authRequired(req, res, next) {
  const uid = bearerToUserId(req.headers.authorization || "");
  if (!uid) return res.status(401).json({ ok: false, error: "No autorizado" });
  req.userId = uid;
  next();
}

/* Helper para endpoints que no usan middleware de auth */
function getUserIdFromReq(req) {
  return (
    bearerToUserId(req.headers.authorization || "") ||
    req.userId ||
    (req.user && req.user.id) ||
    req.body.userId ||
    null
  );
}

/* =========================
   Diario (selección determinística)
   ========================= */
async function ensureTodayDiario() {
  const fecha = todayKey(APP_TZ);
  const exist = await q(`SELECT 1 FROM diario WHERE fecha=? LIMIT 1`, [fecha]);
  if (exist.length) return;

  const [{ c: cj }] = await q(`SELECT COUNT(*) AS c FROM jugadores`);
  const [{ c: ce }] = await q(`SELECT COUNT(*) AS c FROM equipos`);
  if (!cj || !ce) return;
const offJ = seededOffset(cj, `JUGADOR:${fecha}`);
const offE = seededOffset(ce, `EQUIPO:${fecha}`);

const offsetJ = Math.max(0, Math.min(cj - 1, Number(offJ) | 0));
const offsetE = Math.max(0, Math.min(ce - 1, Number(offE) | 0));

const [rowJ] = await q(
  `SELECT id_jugador FROM jugadores ORDER BY id_jugador LIMIT ${offsetJ}, 1`
);
const [rowE] = await q(
  `SELECT id_equipos FROM equipos ORDER BY id_equipos LIMIT ${offsetE}, 1`
);

  if (!rowJ || !rowE) return;

  await q(
    `INSERT IGNORE INTO diario (fecha, jugador_diario, equipo_diario) VALUES (?,?,?)`,
    [fecha, rowJ.id_jugador, rowE.id_equipos]
  );
}

// Middleware global: asegura la fila del día
app.use(async (_req, _res, next) => {
  try {
    await ensureTodayDiario();
  } catch {}
  next();
});

async function getDailySelection() {
  const date = todayKey(APP_TZ);
  await ensureTodayDiario();
  const rows = await q(
    `SELECT jugador_diario AS jugadorId, equipo_diario AS equipoId
     FROM diario WHERE fecha = ? LIMIT 1`,
    [date]
  );
  if (!rows.length) throw new Error("No hay fila en diario para hoy");
  return { date, jugadorId: rows[0].jugadorId, equipoId: rows[0].equipoId };
}

function normaliza(s = "") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

/* ===== Helper: ¿ya resolvió hoy este modo? ===== */
// -- ORIGINAL (comentado)
// async function alreadySolvedToday(userId, which) {
//   if (!userId) return false;
//   const condTipo =
//     which === "player"
//       ? "(tipo='player' OR (tipo IS NULL AND player_intentado IS NOT NULL))"
//       : "(tipo='team'   OR (tipo IS NULL AND equipo_intentado  IS NOT NULL))";
//   const rows = await q(
//     `SELECT COUNT(*) AS c
//        FROM intentos
//       WHERE intento_usuario=? AND es_correcto=1
//         AND (dia = CURDATE() OR DATE(fecha) = CURDATE())
//         AND ${condTipo}
//       LIMIT 1`,
//     [userId]
//   );
//   const r = rows && rows[0] ? rows[0] : { c: 0 };
//   return (r.c || 0) > 0;
// }
// -- NUEVO (con TZ segura)
async function alreadySolvedToday(userId, which) {
  if (!userId) return false;
  const tz = APP_TZ;
  const today = todayKey(APP_TZ); // 'YYYY-MM-DD'

  const condTipo =
    which === "player"
      ? "(tipo='player' OR (tipo IS NULL AND player_intentado IS NOT NULL))"
      : "(tipo='team'   OR (tipo IS NULL AND equipo_intentado  IS NOT NULL))";

  const rows = await q(
    `SELECT COUNT(*) AS c
       FROM intentos
      WHERE intento_usuario=? AND es_correcto=1
        AND (
             dia = ?
             OR DATE(CONVERT_TZ(fecha,'+00:00', ?)) = ?
        )
        AND ${condTipo}
      LIMIT 1`,
    [userId, today, tz, today]
  );
  return (rows?.[0]?.c || 0) > 0;
}

/* ===== ¿El desafío de hoy fue CAMBIADO por admin? ===== */
// -- ORIGINAL (comentado, usaba CURDATE/UTC)
// async function challengeChangedToday(which) {
//   if (which === "player") {
//     const [cur] = await q(
//       `SELECT j.nombre AS name
//          FROM diario d
//          JOIN jugadores j ON j.id_jugador = d.jugador_diario
//         WHERE d.fecha = CURDATE() LIMIT 1`
//     );
//     if (!cur) return false;
//     const [r] = await q(
//       `SELECT COUNT(*) AS c
//          FROM intentos
//         WHERE es_correcto=1
//           AND (dia = CURDATE() OR DATE(fecha)=CURDATE())
//           AND (tipo='player' OR (tipo IS NULL AND player_intentado IS NOT NULL))
//           AND player_intentado IS NOT NULL
//           AND LOWER(player_intentado) <> LOWER(?)`,
//       [cur.name]
//     );
//     return (r?.c || 0) > 0;
//   } else {
//     const [cur] = await q(
//       `SELECT e.nombre_eq AS name
//          FROM diario d
//          JOIN equipos e ON e.id_equipos = d.equipo_diario
//         WHERE d.fecha = CURDATE() LIMIT 1`
//     );
//     if (!cur) return false;
//     const [r] = await q(
//       `SELECT COUNT(*) AS c
//          FROM intentos
//         WHERE es_correcto=1
//           AND (dia = CURDATE() OR DATE(fecha)=CURDATE())
//           AND (tipo='team' OR (tipo IS NULL AND equipo_intentado IS NOT NULL))
//           AND equipo_intentado IS NOT NULL
//           AND LOWER(equipo_intentado) <> LOWER(?)`,
//       [cur.name]
//     );
//     return (r?.c || 0) > 0;
//   }
// }
// -- NUEVO (con TZ segura)
async function challengeChangedToday(which) {
  const tz = APP_TZ;
  const today = todayKey(APP_TZ);

  if (which === "player") {
    const [cur] = await q(
      `SELECT j.nombre AS name
         FROM diario d
         JOIN jugadores j ON j.id_jugador = d.jugador_diario
        WHERE d.fecha = ? LIMIT 1`,
      [today]
    );
    if (!cur) return false;
    const [r] = await q(
      `SELECT COUNT(*) AS c
         FROM intentos
        WHERE es_correcto=1
          AND (
               dia = ?
               OR DATE(CONVERT_TZ(fecha,'+00:00', ?)) = ?
          )
          AND (tipo='player' OR (tipo IS NULL AND player_intentado IS NOT NULL))
          AND player_intentado IS NOT NULL
          AND LOWER(player_intentado) <> LOWER(?)`,
      [today, tz, today, cur.name]
    );
    return (r?.c || 0) > 0;
  } else {
    const [cur] = await q(
      `SELECT e.nombre_eq AS name
         FROM diario d
         JOIN equipos e ON e.id_equipos = d.equipo_diario
        WHERE d.fecha = ? LIMIT 1`,
      [today]
    );
    if (!cur) return false;
    const [r] = await q(
      `SELECT COUNT(*) AS c
         FROM intentos
        WHERE es_correcto=1
          AND (
               dia = ?
               OR DATE(CONVERT_TZ(fecha,'+00:00', ?)) = ?
          )
          AND (tipo='team' OR (tipo IS NULL AND equipo_intentado IS NOT NULL))
          AND equipo_intentado IS NOT NULL
          AND LOWER(equipo_intentado) <> LOWER(?)`,
      [today, tz, today, cur.name]
    );
    return (r?.c || 0) > 0;
  }
}

// idioma desde query ?lang=es|en
function pickLang(req) {
  const q = (req.query.lang || "").toString().toLowerCase();
  return (q === "en" || q === "es") ? q : "es";
}

// ---- PLAYER META (pistas traducidas) ----
app.get('/api/daily/player/meta', async (req, res) => {
  try {
    const { date, jugadorId } = await getDailySelection();
    const lang = pickLang(req);

    const meta = await new Promise((resolve, reject) => {
      const sql = `
        SELECT j.nombre, j.nacionalidad, j.edad, j.juegoprof, j.primerequipo,
               e.nombre_eq AS equipo_actual
        FROM jugadores j
        LEFT JOIN equipos e ON e.id_equipos = j.equipo_id
        WHERE j.id_jugador = ? LIMIT 1
      `;
      db.query(sql, [jugadorId], (e, rows) => e ? reject(e) : resolve(rows[0]));
    });

    const L = {
      es: {
        nationality: 'Nacionalidad',
        age: 'Edad',
        pro_game: 'Juego profesional',
        first_team: 'Primer equipo',
        current_team: 'Equipo actual'
      },
      en: {
        nationality: 'Nationality',
        age: 'Age',
        pro_game: 'Pro game',
        first_team: 'First team',
        current_team: 'Current team'
      }
    }[lang];

    const hints = [
      `${L.nationality}: ${meta.nacionalidad}`,
      `${L.age}: ${meta.edad}`,
      `${L.pro_game}: ${meta.juegoprof}`,
      `${L.first_team}: ${meta.primerequipo}`,
      `${L.current_team}: ${meta.equipo_actual || '-'}`
    ];

    res.set('Cache-Control', 'no-store');
    res.json({
      ok: true,
      date,
      letters: (meta.nombre || '').length,
      hints
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'No se pudo obtener el jugador del día' });
  }
});

// ---- TEAM META (pistas traducidas) ----
app.get('/api/daily/team/meta', async (req, res) => {
  try {
    const { date, equipoId } = await getDailySelection();
    const lang = pickLang(req);

    const meta = await new Promise((resolve, reject) => {
      const sql = `
        SELECT nombre_eq, region, lugfundacion, aniofundacion, juegos
        FROM equipos WHERE id_equipos = ? LIMIT 1
      `;
      db.query(sql, [equipoId], (e, rows) => e ? reject(e) : resolve(rows[0]));
    });

    const L = {
      es: {
        region: 'Región',
        founded_place: 'Lugar de fundación',
        founded_year: 'Año de fundación',
        games: 'Juegos'
      },
      en: {
        region: 'Region',
        founded_place: 'Founding place',
        founded_year: 'Year founded',
        games: 'Games'
      }
    }[lang];

    const hints = [
      `${L.region}: ${meta.region}`,
      `${L.founded_place}: ${meta.lugfundacion}`,
      `${L.founded_year}: ${meta.aniofundacion}`,
      `${L.games}: ${meta.juegos}`
    ];

    res.set('Cache-Control', 'no-store');
    res.json({
      ok: true,
      date,
      letters: (meta.nombre_eq || '').length,
      hints
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'No se pudo obtener el equipo del día' });
  }
});

/* ===== GUESS: jugador ===== */
app.post("/api/daily/player/guess", async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const guessRaw = (req.body.guess || "").trim();
    if (!guessRaw)
      return res.status(400).json({ ok: false, error: "Falta el nombre" });

    // Cambio admin -> práctica
    if (await challengeChangedToday("player")) {
      const [row] = await q(
        "SELECT id_jugador FROM jugadores WHERE LOWER(nombre)=LOWER(?) LIMIT 1",
        [guessRaw]
      );
      if (!row) {
        return res.status(404).json({
          ok: false,
          code: "NAME_NOT_FOUND",
          error: `El jugador "${guessRaw}" no existe o no ha sido agregado a la base de datos`,
        });
      }
      const { jugadorId } = await getDailySelection();
      const correcto = row.id_jugador === jugadorId;
      return res.json({ ok: true, valido: false, correcto, challenge_changed: true });
    }

    // Validamos nombre
    const qExist =
      "SELECT id_jugador, nombre FROM jugadores WHERE LOWER(nombre) = LOWER(?) LIMIT 1";
    db.query(qExist, [guessRaw], async (e1, rows1) => {
      if (e1)
        return res.status(500).json({ ok: false, error: "Error verificando jugador" });
      if (!rows1 || !rows1.length) {
        return res.status(404).json({
          ok: false,
          code: "NAME_NOT_FOUND",
          error: `El jugador "${guessRaw}" no existe o no ha sido agregado a la base de datos`,
        });
      }

      // Ya resolvió HOY
      if (await alreadySolvedToday(userId, "player")) {
        const { jugadorId } = await getDailySelection();
        const correcto = rows1[0].id_jugador === jugadorId;
        return res.json({ ok: true, valido: false, correcto, already_done: true });
      }

      // Primera vez del día: registramos
      const found = rows1[0];
      const { jugadorId } = await getDailySelection();
      const correcto = found.id_jugador === jugadorId;
      const hoy = todayKey(APP_TZ);

      const sql = `INSERT INTO intentos
                   (intento_usuario, player_intentado, tipo, es_correcto, fecha, dia)
                   VALUES (?, ?, 'player', ?, NOW(), ?)`;
      db.query(sql, [userId, found.nombre, correcto ? 1 : 0, hoy], (e2) => {
        if (e2) console.warn("No se pudo registrar intento:", e2.message);
        return res.json({ ok: true, valido: true, correcto });
      });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "No se pudo procesar el intento" });
  }
});

/* ===== GUESS: equipo ===== */
app.post("/api/daily/team/guess", async (req, res) => {
  try {
    const userId = getUserIdFromReq(req);
    const guessRaw = (req.body.guess || "").trim();
    if (!guessRaw)
      return res.status(400).json({ ok: false, error: "Falta el nombre" });

    // Cambio admin -> práctica
    if (await challengeChangedToday("team")) {
      const [row] = await q(
        "SELECT id_equipos FROM equipos WHERE LOWER(nombre_eq)=LOWER(?) LIMIT 1",
        [guessRaw]
      );
      if (!row) {
        return res.status(404).json({
          ok: false,
          code: "NAME_NOT_FOUND",
          error: `El equipo "${guessRaw}" no existe o no ha sido agregado a la base de datos`,
        });
      }
      const { equipoId } = await getDailySelection();
      const correcto = row.id_equipos === equipoId;
      return res.json({ ok: true, valido: false, correcto, challenge_changed: true });
    }

    // Validamos nombre
    const qExist =
      "SELECT id_equipos, nombre_eq FROM equipos WHERE LOWER(nombre_eq) = LOWER(?) LIMIT 1";
    db.query(qExist, [guessRaw], async (e1, rows1) => {
      if (e1)
        return res.status(500).json({ ok: false, error: "Error verificando equipo" });
      if (!rows1 || !rows1.length) {
        return res.status(404).json({
          ok: false,
          code: "NAME_NOT_FOUND",
          error: `El equipo "${guessRaw}" no existe o no ha sido agregado a la base de datos`,
        });
      }

      // Ya resolvió HOY
      if (await alreadySolvedToday(userId, "team")) {
        const { equipoId } = await getDailySelection();
        const correcto = rows1[0].id_equipos === equipoId;
        return res.json({ ok: true, valido: false, correcto, already_done: true });
      }

      // Primera vez del día: registramos
      const found = rows1[0];
      const { equipoId } = await getDailySelection();
      const correcto = found.id_equipos === equipoId;
      const hoy = todayKey(APP_TZ);

      const sql = `INSERT INTO intentos
                   (intento_usuario, equipo_intentado, tipo, es_correcto, fecha, dia)
                   VALUES (?, ?, 'team', ?, NOW(), ?)`;
      db.query(sql, [userId, found.nombre_eq, correcto ? 1 : 0, hoy], (e2) => {
        if (e2) console.warn("No se pudo registrar intento:", e2.message);
        return res.json({ ok: true, valido: true, correcto });
      });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "No se pudo procesar el intento" });
  }
});

/* =========================
   Rutas adicionales UI
   ========================= */
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "indexnuevo.html"));
});

app.post("/adivinar/jugador", async (req, res) => {
  try {
    const { nombre } = req.body;
    const fecha = todayKey(APP_TZ);
    const [row] = await q(
      `SELECT j.nombre AS nombreCorrecto
       FROM diario d
       JOIN jugadores j ON d.jugador_diario = j.id_jugador
       WHERE d.fecha = ? LIMIT 1`,
      [fecha]
    );
    if (!row)
      return res.status(404).json({
        correcto: false,
        nombreCorrecto: null,
        error: "No hay jugador asignado para hoy",
      });
    const esCorrecto =
      row.nombreCorrecto &&
      row.nombreCorrecto.toLowerCase() === (nombre || "").toLowerCase();
    res.json({ correcto: esCorrecto, nombreCorrecto: row.nombreCorrecto });
  } catch (e) {
    console.error("Error en consulta jugador:", e);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

app.post("/adivinar/equipo", async (req, res) => {
  try {
    const { nombre } = req.body;
    const fecha = todayKey(APP_TZ);
    const [row] = await q(
      `SELECT e.nombre_eq AS nombreCorrecto
       FROM diario d
       JOIN equipos e ON d.equipo_diario = e.id_equipos
       WHERE d.fecha = ? LIMIT 1`,
      [fecha]
    );
    if (!row)
      return res.status(404).json({
        correcto: false,
        nombreCorrecto: null,
        error: "No hay equipo asignado para hoy",
      });
    const esCorrecto =
      row.nombreCorrecto &&
      row.nombreCorrecto.toLowerCase() === (nombre || "").toLowerCase();
    res.json({ correcto: esCorrecto, nombreCorrecto: row.nombreCorrecto });
  } catch (e) {
    console.error("Error en consulta equipo:", e);
    res.status(500).json({ error: "Error en la base de datos" });
  }
});

// =========================
// Utilitarios diario (HOY/AYER)
// =========================
// -- ORIGINAL (comentado)
// app.get("/api/diario/hoy", async (_req, res) => {
//   try {
//     const row = await q(
//       `SELECT d.fecha, j.nombre AS jugador, e.nombre_eq AS equipo
//        FROM diario d
//        JOIN jugadores j ON j.id_jugador = d.jugador_diario
//        JOIN equipos   e ON e.id_equipos   = d.equipo_diario
//        WHERE d.fecha = CURDATE()
//        LIMIT 1`
//     );
//     if (!row.length) return res.status(404).json({ ok: false });
//     res.json({ ok: true, ...row[0] });
//   } catch {
//     res.status(500).json({ ok: false });
//   }
// });
// -- NUEVO
app.get("/api/diario/hoy", async (_req, res) => {
  try {
    const row = await q(
      `SELECT d.fecha, j.nombre AS jugador, e.nombre_eq AS equipo
       FROM diario d
       JOIN jugadores j ON j.id_jugador = d.jugador_diario
       JOIN equipos   e ON e.id_equipos   = d.equipo_diario
       WHERE d.fecha = ?
       LIMIT 1`,
      [todayKey(APP_TZ)]
    );
    if (!row.length) return res.status(404).json({ ok: false });
    res.json({ ok: true, ...row[0] });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// -- ORIGINAL (comentado)
// app.get("/api/diario/ayer", async (_req, res) => {
//   try {
//     const row = await q(
//       `SELECT d.fecha, j.nombre AS jugador, e.nombre_eq AS equipo
//        FROM diario d
//        JOIN jugadores j ON j.id_jugador = d.jugador_diario
//        JOIN equipos   e ON e.id_equipos   = d.equipo_diario
//        WHERE d.fecha = CURDATE() - INTERVAL 1 DAY
//        LIMIT 1`
//     );
//     if (!row.length) return res.status(404).json({ ok: false });
//     res.json({ ok: true, ...row[0] });
//   } catch {
//     res.status(500).json({ ok: false });
//   }
// });
// -- NUEVO
app.get("/api/diario/ayer", async (_req, res) => {
  try {
    const today = todayKey(APP_TZ);
    const [Y, M, D] = today.split("-").map(Number);
    const t = Date.UTC(Y, M - 1, D) - 86400000; // -1 día
    const dt = new Date(t);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    const yesterday = `${yy}-${mm}-${dd}`;

    const row = await q(
      `SELECT d.fecha, j.nombre AS jugador, e.nombre_eq AS equipo
       FROM diario d
       JOIN jugadores j ON j.id_jugador = d.jugador_diario
       JOIN equipos   e ON e.id_equipos   = d.equipo_diario
       WHERE d.fecha = ?
       LIMIT 1`,
      [yesterday]
    );
    if (!row.length) return res.status(404).json({ ok: false });
    res.json({ ok: true, ...row[0] });
  } catch {
    res.status(500).json({ ok: false });
  }
});

/* =========================
   ACCOUNT SUMMARY
   ========================= */
// -- ORIGINAL (comentado)
// app.get("/api/account/summary", authRequired, async (req, res) => {
//   const uid = req.userId;
//   const [tPlayer] = await q(
//     `SELECT COUNT(*) c
//        FROM intentos
//       WHERE intento_usuario=?
//         AND es_correcto=1
//         AND (dia = CURDATE() OR DATE(fecha) = CURDATE())
//         AND (tipo='player' OR (tipo IS NULL AND player_intentado IS NOT NULL))`,
//     [uid]
//   );
//   const [tTeam] = await q(
//     `SELECT COUNT(*) c
//        FROM intentos
//       WHERE intento_usuario=?
//         AND es_correcto=1
//         AND (dia = CURDATE() OR DATE(fecha) = CURDATE())
//         AND (tipo='team' OR (tipo IS NULL AND equipo_intentado IS NOT NULL))`,
//     [uid]
//   );
//   // ... (resto igual)
// });
// -- NUEVO
app.get("/api/account/summary", authRequired, async (req, res) => {
  const uid = req.userId;
  const tz = APP_TZ;
  const today = todayKey(APP_TZ);

  const [tPlayer] = await q(
    `SELECT COUNT(*) c
       FROM intentos
      WHERE intento_usuario=?
        AND es_correcto=1
        AND (
             dia = ?
             OR DATE(CONVERT_TZ(fecha,'+00:00', ?)) = ?
        )
        AND (tipo='player' OR (tipo IS NULL AND player_intentado IS NOT NULL))`,
    [uid, today, tz, today]
  );

  const [tTeam] = await q(
    `SELECT COUNT(*) c
       FROM intentos
      WHERE intento_usuario=?
        AND es_correcto=1
        AND (
             dia = ?
             OR DATE(CONVERT_TZ(fecha,'+00:00', ?)) = ?
        )
        AND (tipo='team' OR (tipo IS NULL AND equipo_intentado IS NOT NULL))`,
    [uid, today, tz, today]
  );

  // Traer todos los días acertados (string 'YYYY-MM-DD')
  const rows = await q(
    `SELECT
        DATE_FORMAT(COALESCE(dia, DATE(fecha)), '%Y-%m-%d') AS d,
        CASE WHEN (tipo='player' OR (tipo IS NULL AND player_intentado IS NOT NULL)) THEN 1 ELSE 0 END AS is_player,
        CASE WHEN (tipo='team'   OR (tipo IS NULL AND equipo_intentado IS NOT NULL)) THEN 1 ELSE 0 END AS is_team
     FROM intentos
     WHERE intento_usuario=? AND es_correcto=1`,
    [uid]
  );

  // Agregar por día y quedarnos con los que tienen ambos retos completos
  const agg = new Map(); // d -> {p,t}
  for (const r of rows) {
    const key = r.d;
    const cur = agg.get(key) || { p: 0, t: 0 };
    cur.p += r.is_player;
    cur.t += r.is_team;
    agg.set(key, cur);
  }
  const daysBoth = [...agg.entries()]
    .filter(([, v]) => v.p > 0 && v.t > 0)
    .map(([d]) => d);

  const days_completed = daysBoth.length;

  // Racha: contar desde HOY hacia atrás, comparando strings 'YYYY-MM-DD'
  const setBoth = new Set(daysBoth);

  function prevDayStr(s /* 'YYYY-MM-DD' */) {
    const [y, m, d] = s.split("-").map(Number);
    const t = Date.UTC(y, m - 1, d) - 86400000; // -1 día
    const dt = new Date(t);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  const todayStr = todayKey(APP_TZ);
  let key = todayStr;
  let streak = 0;
  while (setBoth.has(key)) {
    streak++;
    key = prevDayStr(key);
  }

  res.json({
    ok: true,
    today: { player_done: !!tPlayer.c, team_done: !!tTeam.c },
    stats: { days_played: days_completed, streak },
  });
});

/* =========================
   GLOBAL RANKING (idéntico)
   ========================= */
app.get("/api/ranking", async (req, res) => {
  try {
    const sort = (req.query.sort || "streak").toString() === "days" ? "days" : "streak";
    const limit = Math.min(Math.max(parseInt(req.query.limit || "100", 10), 1), 500);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const rows = await q(`
      SELECT
        i.intento_usuario                                   AS uid,
        DATE_FORMAT(COALESCE(i.dia, DATE(i.fecha)), '%Y-%m-%d') AS d,
        CASE WHEN (i.tipo='player' OR (i.tipo IS NULL AND i.player_intentado IS NOT NULL)) THEN 1 ELSE 0 END AS is_player,
        CASE WHEN (i.tipo='team'   OR (i.tipo IS NULL AND i.equipo_intentado IS NOT NULL)) THEN 1 ELSE 0 END AS is_team
      FROM intentos i
      WHERE i.es_correcto=1
    `);

    const perUserDay = new Map(); // uid -> Map(day -> {p,t})
    for (const r of rows) {
      const u = String(r.uid);
      const d = r.d;
      if (!perUserDay.has(u)) perUserDay.set(u, new Map());
      const dayMap = perUserDay.get(u);
      const cur = dayMap.get(d) || { p: 0, t: 0 };
      cur.p += r.is_player;
      cur.t += r.is_team;
      dayMap.set(d, cur);
    }

    function prevDayStr(s /* 'YYYY-MM-DD' */) {
      const [y, m, d] = s.split("-").map(Number);
      const t = Date.UTC(y, m - 1, d) - 86400000;
      const dt = new Date(t);
      const yy = dt.getUTCFullYear();
      const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(dt.getUTCDate()).padStart(2, "0");
      return `${yy}-${mm}-${dd}`;
    }
    const today = todayKey(APP_TZ);

    const stats = [];
    const users = await q(`SELECT id_usuarios AS id, nombre_usuario AS username FROM usuarios`);

    const usernameById = new Map(users.map(u => [String(u.id), u.username || `user_${u.id}`]));

    for (const [uid, dayMap] of perUserDay.entries()) {
      const daysBoth = [];
      for (const [d, v] of dayMap.entries()) {
        if ((v.p > 0) && (v.t > 0)) daysBoth.push(d);
      }
      const setBoth = new Set(daysBoth);

      let k = today;
      let streak = 0;
      while (setBoth.has(k)) {
        streak++;
        k = prevDayStr(k);
      }

      stats.push({
        id: parseInt(uid, 10),
        username: usernameById.get(uid) || `user_${uid}`,
        days_completed: daysBoth.length,
        streak
      });
    }

    for (const u of users) {
      const exists = stats.find(x => x.id === u.id);
      if (!exists) {
        stats.push({ id: u.id, username: u.username || `user_${u.id}`, days_completed: 0, streak: 0 });
      }
    }

    if (sort === "days") {
      stats.sort((a, b) => {
        if (b.days_completed !== a.days_completed) return b.days_completed - a.days_completed;
        if (b.streak !== a.streak) return b.streak - a.streak;
        return a.username.localeCompare(b.username, 'es', { sensitivity: 'base' });
      });
    } else {
      stats.sort((a, b) => {
        if (b.streak !== a.streak) return b.streak - a.streak;
        if (b.days_completed !== a.days_completed) return b.days_completed - a.days_completed;
        return a.username.localeCompare(b.username, 'es', { sensitivity: 'base' });
      });
    }

    const total = stats.length;
    const sliced = stats.slice(offset, offset + limit);

    res.json({ ok: true, total, items: sliced });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"No se pudo obtener el ranking" });
  }
});

// --- ALIAS legacy /players y /teams (los mantengo tal cual) ---
function likeParam(q) {
  q = (q || "").toString().trim();
  return q ? `%${q}%` : "%";
}
app.get("/players", authRequired, async (req, res) => {
  try {
    const qparam = likeParam(req.query.q);
    const rows = await q(
      `SELECT id_jugador AS id, nombre AS name
         FROM jugadores
        WHERE nombre LIKE ?
        ORDER BY nombre COLLATE utf8mb4_unicode_ci ASC
        LIMIT 20`,
      [qparam]
    );
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, items: rows || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"No se pudo buscar jugadores" });
  }
});
app.get("/teams", authRequired, async (req, res) => {
  try {
    const qparam = likeParam(req.query.q);
    const rows = await q(
      `SELECT id_equipos AS id, nombre_eq AS name
         FROM equipos
        WHERE nombre_eq LIKE ?
        ORDER BY nombre_eq COLLATE utf8mb4_unicode_ci ASC
        LIMIT 20`,
      [qparam]
    );
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, items: rows || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"No se pudo buscar equipos" });
  }
});

// Autocomplete + browse (sin cambios)
function prefixParam(q) {
  q = (q || "").toString().trim();
  return q ? `${q}%` : "%";
}
app.get("/api/search/players", async (req, res) => {
  try {
    const qparam = likeParam(req.query.q);
    const rows = await q(
      `SELECT id_jugador AS id, nombre AS name
         FROM jugadores
        WHERE nombre LIKE ?
        ORDER BY nombre COLLATE utf8mb4_unicode_ci ASC
        LIMIT 20`,
      [qparam]
    );
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, items: rows || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"No se pudo buscar jugadores" });
  }
});
app.get("/api/search/teams", async (req, res) => {
  try {
    const qparam = likeParam(req.query.q);
    const rows = await q(
      `SELECT id_equipos AS id, nombre_eq AS name
         FROM equipos
        WHERE nombre_eq LIKE ?
        ORDER BY nombre_eq COLLATE utf8mb4_unicode_ci ASC
        LIMIT 20`,
      [qparam]
    );
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, items: rows || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"No se pudo buscar equipos" });
  }
});
app.get("/api/browse/players", async (req, res) => {
  try {
    const qpref = prefixParam(req.query.q);
    const rows = await q(
      `SELECT id_jugador AS id, nombre AS name
         FROM jugadores
        WHERE nombre LIKE ?
        ORDER BY nombre COLLATE utf8mb4_unicode_ci ASC
        LIMIT 100`,
      [qpref]
    );
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, items: rows || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"No se pudo buscar jugadores" });
  }
});
app.get("/api/browse/teams", async (req, res) => {
  try {
    const qpref = prefixParam(req.query.q);
    const rows = await q(
      `SELECT id_equipos AS id, nombre_eq AS name
         FROM equipos
        WHERE nombre_eq LIKE ?
        ORDER BY nombre_eq COLLATE utf8mb4_unicode_ci ASC
        LIMIT 100`,
      [qpref]
    );
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, items: rows || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:"No se pudo buscar equipos" });
  }
});

/* =========================
   ADMIN (ajustes TZ en stats de HOY)
   ========================= */
// -- ORIGINAL (comentado)
// app.get("/api/admin/stats/today", requireAdmin, async (_req, res) => {
//   try {
//     const player = await q(
//       `SELECT COUNT(DISTINCT intento_usuario) AS c
//        FROM intentos
//        WHERE (dia=CURDATE() OR DATE(fecha)=CURDATE())
//          AND player_intentado IS NOT NULL`
//     );
//     const team = await q(
//       `SELECT COUNT(DISTINCT intento_usuario) AS c
//        FROM intentos
//        WHERE (dia=CURDATE() OR DATE(fecha)=CURDATE())
//          AND equipo_intentado IS NOT NULL`
//     );
//     res.json({
//       ok: true,
//       today: { players: player[0].c || 0, teams: team[0].c || 0 },
//     });
//   } catch (e) {
//     res.status(500).json({ ok: false, error: "No se pudieron obtener estadísticas" });
//   }
// });
app.get("/api/admin/stats/today", requireAdmin, async (_req, res) => {
  try {
    const tz = APP_TZ;
    const today = todayKey(APP_TZ);

    const player = await q(
      `SELECT COUNT(DISTINCT intento_usuario) AS c
       FROM intentos
       WHERE (
              dia = ?
              OR DATE(CONVERT_TZ(fecha,'+00:00', ?)) = ?
       )
         AND player_intentado IS NOT NULL`,
      [today, tz, today]
    );
    const team = await q(
      `SELECT COUNT(DISTINCT intento_usuario) AS c
       FROM intentos
       WHERE (
              dia = ?
              OR DATE(CONVERT_TZ(fecha,'+00:00', ?)) = ?
       )
         AND equipo_intentado IS NOT NULL`,
      [today, tz, today]
    );
    res.json({
      ok: true,
      today: { players: player[0].c || 0, teams: team[0].c || 0 },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "No se pudieron obtener estadísticas" });
  }
});

/* =========================
   Admin: meta y selects (igual)
   ========================= */
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin-fixed-token";

function adminOrRoleBearer(req) {
  return (req.headers["authorization"] || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}
async function requireAdmin(req, res, next) {
  const tok = adminOrRoleBearer(req);
  if (!tok) return res.status(401).json({ ok: false, error: "Admin only" });

  if (tok === ADMIN_TOKEN) return next();

  const parsed = verifyTokenSimple(tok);
  if (!parsed?.id)
    return res.status(401).json({ ok: false, error: "Admin only" });

  try {
    const rows = await q(
      `SELECT role FROM usuarios WHERE id_usuarios=? LIMIT 1`,
      [parsed.id]
    );
    if (!rows.length || rows[0].role !== "admin") {
      return res.status(403).json({ ok: false, error: "Admin only" });
    }
    req.userId = parsed.id;
    next();
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Admin check error" });
  }
}

app.post("/api/auth/admin", (req, res) => {
  const { emailOrUser, username, password } = req.body || {};
  const userField = (emailOrUser || username || "").trim();
  if (userField === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({
      ok: true,
      token: ADMIN_TOKEN,
      user: { id: 0, username: ADMIN_USER, email: "admin@local", role: "admin" },
    });
  }
  return res.status(401).json({ ok: false, error: "Credenciales admin inválidas" });
});

app.get("/api/admin/daily/meta", requireAdmin, async (_req, res) => {
  try {
    const { date, jugadorId, equipoId } = await getDailySelection();
    const pj = await q(
      "SELECT id_jugador AS id, nombre FROM jugadores WHERE id_jugador=?",
      [jugadorId]
    );
    const eq = await q(
      "SELECT id_equipos AS id, nombre_eq AS nombre FROM equipos WHERE id_equipos=?",
      [equipoId]
    );
    res.json({
      ok: true,
      date: String(date).slice(0, 10),
      player: pj[0] || null,
      team: eq[0] || null,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "No se pudo obtener meta admin" });
  }
});

// (sin cambios; sigue usando CURDATE() para escribir hoy en tabla diario)
app.post("/api/admin/daily/set", requireAdmin, async (req, res) => {
  try {
    const { jugadorId, equipoId } = req.body || {};
    if (!jugadorId && !equipoId)
      return res.status(400).json({ ok: false, error: "Nada para cambiar" });

    const today = await q("SELECT fecha FROM diario WHERE fecha = CURDATE()");
    if (!today.length) {
      await q(
        "INSERT INTO diario (fecha, jugador_diario, equipo_diario) VALUES (CURDATE(), COALESCE(?, 1), COALESCE(?, 1))",
        [jugadorId || null, equipoId || null]
      );
    } else {
      if (jugadorId)
        await q("UPDATE diario SET jugador_diario=? WHERE fecha=CURDATE()", [
          jugadorId,
        ]);
      if (equipoId)
        await q("UPDATE diario SET equipo_diario=? WHERE fecha=CURDATE()", [
          equipoId,
        ]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "No se pudo actualizar el diario" });
  }
});

app.get("/api/admin/players", requireAdmin, async (_req, res) => {
  try {
    const rows = await q(
      "SELECT id_jugador AS id, nombre FROM jugadores ORDER BY nombre ASC"
    );
    res.json({ ok: true, items: rows });
  } catch {
    res.status(500).json({ ok: false, error: "No se pudieron listar jugadores" });
  }
});
app.get("/api/admin/teams", requireAdmin, async (_req, res) => {
  try {
    const rows = await q(
      "SELECT id_equipos AS id, nombre_eq AS nombre FROM equipos ORDER BY nombre_eq ASC"
    );
    res.json({ ok: true, items: rows });
  } catch {
    res.status(500).json({ ok: false, error: "No se pudieron listar equipos" });
  }
});

/* =========================
   DEBUG DB (puede borrarse en prod)
   ========================= */
app.get('/debug/db', async (req, res) => {
  try {
    const [info] = await q(`
      SELECT
        @@hostname         AS host_name,
        @@port             AS port_num,
        @@version          AS version,
        @@version_comment  AS version_comment,
        @@ssl_cipher       AS ssl_cipher
    `);
    res.json({
      using_env_host: process.env.DB_HOST,
      using_env_port: process.env.DB_PORT,
      db_info: info,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   Start
   ========================= */
const PORT = process.env.PORT || 3000;
app.set("trust proxy", 1);
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log("[DB] Host:", process.env.DB_HOST);
  console.log("[DB] Port:", process.env.DB_PORT);
});
