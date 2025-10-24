// models/seed.js
// Seed idempotente: UPSERT de equipos y jugadores (no escribe en `diario`)

const db = require('../db');

// Helper promisificado
function q(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

// === Datos base (podés ampliar libremente) ===
const equipos = [
  { nombre_eq: "T1",        lugfundacion: "Corea del Sur", region: "KR", aniofundacion: 2003, juegos: "League of Legends, Valorant" },
  { nombre_eq: "NAVI",      lugfundacion: "Ucrania",       region: "EU", aniofundacion: 2009, juegos: "CS:GO, Valorant" },
  { nombre_eq: "Sentinels", lugfundacion: "EE.UU.",        region: "NA", aniofundacion: 2016, juegos: "Valorant" },
  { nombre_eq: "G2",        lugfundacion: "Alemania",      region: "EU", aniofundacion: 2014, juegos: "LoL, CS:GO, Valorant" },
  { nombre_eq: "Gen.G",     lugfundacion: "Corea del Sur", region: "KR", aniofundacion: 2017, juegos: "LoL, Valorant" },
  { nombre_eq: "FNATIC",    lugfundacion: "Reino Unido",   region: "EU", aniofundacion: 2004, juegos: "LoL, Valorant, CS:GO" }
];

const jugadores = [
  { nombre: "Faker",   equipo: "T1",        nacionalidad: "Coreano",    edad: 27, juegoprof: "League of Legends", primerequipo: "T1" },
  { nombre: "s1mple",  equipo: "NAVI",      nacionalidad: "Ucraniano",  edad: 26, juegoprof: "CS:GO",             primerequipo: "FlipSid3" },
  { nombre: "TenZ",    equipo: "Sentinels", nacionalidad: "Canadiense", edad: 22, juegoprof: "Valorant",          primerequipo: "Cloud9" },
  { nombre: "Caps",    equipo: "G2",        nacionalidad: "Danés",      edad: 23, juegoprof: "LoL",               primerequipo: "FNATIC" },
  { nombre: "Ruler",   equipo: "Gen.G",     nacionalidad: "Coreano",    edad: 24, juegoprof: "LoL",               primerequipo: "Samsung Galaxy" },
  { nombre: "Alfajer", equipo: "FNATIC",    nacionalidad: "Turco",      edad: 20, juegoprof: "Valorant",          primerequipo: "FNATIC" }
];

async function runSeed () {
  // 1) UPSERT equipos
  for (const e of equipos) {
    await q(
      `INSERT INTO equipos (nombre_eq, lugfundacion, region, aniofundacion, juegos)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         lugfundacion=VALUES(lugfundacion),
         region=VALUES(region),
         aniofundacion=VALUES(aniofundacion),
         juegos=VALUES(juegos)`,
      [e.nombre_eq, e.lugfundacion, e.region, e.aniofundacion, e.juegos]
    );
  }
  console.log('✓ Equipos sembrados/actualizados');

  // 2) Mapear nombre de equipo -> id_equipos
  const uniqNames = [...new Set(jugadores.map(j => j.equipo))];
  const placeholders = uniqNames.map(() => '?').join(',');
  const rowsEq = await q(
    `SELECT id_equipos, nombre_eq FROM equipos WHERE nombre_eq IN (${placeholders})`,
    uniqNames
  );
  const mapEq = Object.fromEntries(rowsEq.map(r => [r.nombre_eq, r.id_equipos]));

  // 3) UPSERT jugadores (requiere UNIQUE(nombre, equipo_id))
  for (const j of jugadores) {
    const equipo_id = mapEq[j.equipo];
    if (!equipo_id) { console.warn('⚠️  Equipo no encontrado para', j.nombre, '=>', j.equipo); continue; }

    await q(
      `INSERT INTO jugadores (nombre, equipo_id, nacionalidad, edad, juegoprof, primerequipo)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         nacionalidad=VALUES(nacionalidad),
         edad=VALUES(edad),
         juegoprof=VALUES(juegoprof),
         primerequipo=VALUES(primerequipo)`,
      [j.nombre, equipo_id, j.nacionalidad, j.edad, j.juegoprof, j.primerequipo]
    );
  }
  console.log('✓ Jugadores sembrados/actualizados');

  // Importante: NO tocar `diario` aquí. El servidor lo gestiona (ensureTodayDiario).
  console.log('✅ Seed idempotente completo.');
}

// Soportar ejecución directa y como módulo
if (require.main === module) {
  runSeed()
    .catch(e => console.error('❌ Seed falló:', e))
    .finally(() => db.end());
} else {
  module.exports = runSeed;
}
