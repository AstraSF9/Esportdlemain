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
  { nombre_eq: "FNATIC",    lugfundacion: "Reino Unido",   region: "EU", aniofundacion: 2004, juegos: "LoL, Valorant, CS:GO" },
  { nombre_eq: "Hanwha Life Esports", lugfundacion: "Corea del Sur", region: "KR", aniofundacion: 2018, juegos: "League of Legends, Valorant" },
  { nombre_eq: "KT Rolster",        lugfundacion: "Corea del Sur", region: "KR",  aniofundacion: 1999, juegos: "League of Legends" },
  { nombre_eq: "Dplus KIA",         lugfundacion: "Corea del Sur", region: "KR",  aniofundacion: 2017, juegos: "League of Legends, Valorant" },
  { nombre_eq: "BNK FearX",         lugfundacion: "Corea del Sur", region: "KR",  aniofundacion: 2020, juegos: "League of Legends" },
  { nombre_eq: "Nongshim RedForce", lugfundacion: "Corea del Sur", region: "KR",  aniofundacion: 2020, juegos: "League of Legends" },
  { nombre_eq: "BRION",      lugfundacion: "Corea del Sur", region: "KR",  aniofundacion: 2012, juegos: "League of Legends" },
  { nombre_eq: "DRX",        lugfundacion: "Corea del Sur", region: "KR",  aniofundacion: 2012, juegos: "League of Legends, Valorant" },
  { nombre_eq: "DN Freecs",  lugfundacion: "Corea del Sur", region: "KR",  aniofundacion: 2015, juegos: "League of Legends" },
  { nombre_eq: "Bilibili Gaming",     lugfundacion: "China", region: "CN", aniofundacion: 2017, juegos: "League of Legends, Valorant, CS:GO" },
  { nombre_eq: "Top Esports",         lugfundacion: "China", region: "CN", aniofundacion: 2017, juegos: "League of Legends" },
  { nombre_eq: "Invictus Gaming",     lugfundacion: "China", region: "CN", aniofundacion: 2011, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Anyone's Legend",     lugfundacion: "China", region: "CN", aniofundacion: 2019, juegos: "League of Legends" },
  { nombre_eq: "Weibo Gaming",        lugfundacion: "China", region: "CN", aniofundacion: 2022, juegos: "League of Legends" },
  { nombre_eq: "JD Gaming",           lugfundacion: "China", region: "CN", aniofundacion: 2017, juegos: "League of Legends" },
  { nombre_eq: "Team WE",             lugfundacion: "China", region: "CN", aniofundacion: 2005, juegos: "League of Legends, Valorant" },
  { nombre_eq: "FunPlus Phoenix",     lugfundacion: "China", region: "CN", aniofundacion: 2017, juegos: "League of Legends, Valorant, CS:GO" },
  { nombre_eq: "Ninjas in Pyjamas",   lugfundacion: "China", region: "CN", aniofundacion: 2023, juegos: "League of Legends, Valorant" },
  { nombre_eq: "EDward Gaming",       lugfundacion: "China", region: "CN", aniofundacion: 2014, juegos: "League of Legends, Valorant, CS:GO" },
  { nombre_eq: "LGD Gaming",          lugfundacion: "China", region: "CN", aniofundacion: 2009, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Ultra Prime",         lugfundacion: "China", region: "CN", aniofundacion: 2023, juegos: "League of Legends" },
  { nombre_eq: "LNG Esports",         lugfundacion: "China", region: "CN", aniofundacion: 2018, juegos: "League of Legends, Valorant" },
  { nombre_eq: "ThunderTalk Gaming",  lugfundacion: "China", region: "CN", aniofundacion: 2020, juegos: "League of Legends" },
  { nombre_eq: "Movistar KOI",     lugfundacion: "España",    region: "EU", aniofundacion: 2021, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Karmine Corp",     lugfundacion: "Francia",  region: "EU", aniofundacion: 2020, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Team Vitality",    lugfundacion: "Francia",  region: "EU", aniofundacion: 2013, juegos: "League of Legends, Valorant, CS:GO" },
  { nombre_eq: "GIANTX",           lugfundacion: "Francia",  region: "EU", aniofundacion: 2022, juegos: "League of Legends" },
  { nombre_eq: "SK Gaming",        lugfundacion: "Alemania", region: "EU", aniofundacion: 1997, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Team BDS",         lugfundacion: "Suiza",    region: "EU", aniofundacion: 2018, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Team Heretics",    lugfundacion: "España",    region: "EU", aniofundacion: 2016, juegos: "League of Legends, Valorant" },
  { nombre_eq: "100 Thieves", lugfundacion: "EE.UU.", region: "NA", aniofundacion: 2017, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Cloud9", lugfundacion: "EE.UU.", region: "NA", aniofundacion: 2013, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Dignitas", lugfundacion: "EE.UU.", region: "NA", aniofundacion: 2013, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Disguised", lugfundacion: "EE.UU.", region: "NA", aniofundacion: 2022, juegos: "League of Legends, Valorant" },
  { nombre_eq: "FlyQuest", lugfundacion: "EE.UU.", region: "NA", aniofundacion: 2017, juegos: "League of Legends, Valorant" },
  { nombre_eq: "LYON Gaming", lugfundacion: "México", region: "NA", aniofundacion: 2013, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Shopify Rebellion", lugfundacion: "EE.UU.", region: "NA", aniofundacion: 2020, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Team Liquid", lugfundacion: "EE.UU.", region: "NA", aniofundacion: 2000, juegos: "League of Legends, Valorant, CS:GO" },
  { nombre_eq: "RED Canids Kalunga", lugfundacion: "Brasil", region: "BR", aniofundacion: 2019, juegos: "League of Legends, Valorant" },
  { nombre_eq: "FURIA Esports", lugfundacion: "Brasil", region: "BR", aniofundacion: 2017, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Vivo Keyd Stars", lugfundacion: "Brasil", region: "BR", aniofundacion: 2012, juegos: "League of Legends, Valorant" },
  { nombre_eq: "paiN Gaming", lugfundacion: "Brasil", region: "BR", aniofundacion: 2012, juegos: "League of Legends, Valorant" },
  { nombre_eq: "LOUD", lugfundacion: "Brasil", region: "BR", aniofundacion: 2019, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Leviatán", lugfundacion: "Argentina", region: "BR", aniofundacion: 2021, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Isurus", lugfundacion: "Argentina", region: "BR", aniofundacion: 2011, juegos: "League of Legends, Valorant" },
  { nombre_eq: "Fluxo W7M", lugfundacion: "Brasil", region: "BR", aniofundacion: 2023, juegos: "League of Legends, Valorant" },
  { nombre_eq: "KRU Visa", lugfundacion: "Argentina", region: "BR", aniofundacion: 2020, juegos: "CS:GO, Valorant" }
];

const jugadores = [
  { nombre: "Faker",   equipo: "T1",        nacionalidad: "Coreano",    edad: 27, juegoprof: "League of Legends", primerequipo: "T1" },
  { nombre: "s1mple",  equipo: "NAVI",      nacionalidad: "Ucraniano",  edad: 26, juegoprof: "CS:GO",             primerequipo: "FlipSid3" },
  { nombre: "TenZ",    equipo: "Sentinels", nacionalidad: "Canadiense", edad: 22, juegoprof: "Valorant",          primerequipo: "Cloud9" },
  { nombre: "Caps",    equipo: "G2",        nacionalidad: "Danés",      edad: 23, juegoprof: "LoL",               primerequipo: "FNATIC" },
  { nombre: "Ruler",   equipo: "Gen.G",     nacionalidad: "Coreano",    edad: 24, juegoprof: "LoL",               primerequipo: "Samsung Galaxy" },
  { nombre: "Alfajer", equipo: "FNATIC",    nacionalidad: "Turco",      edad: 20, juegoprof: "Valorant",          primerequipo: "FNATIC" },
  { nombre: "Oner",      equipo: "T1",      nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends",    primerequipo: "T1" },
  { nombre: "Gumayusi",  equipo: "T1",      nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends",    primerequipo: "T1" },
  { nombre: "Keria",     equipo: "T1",      nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends",    primerequipo: "T1" },
  { nombre: "Doran",     equipo: "T1",      nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends",    primerequipo: "Griffin" },
  { nombre: "Kiin",      equipo: "Gen.G",         nacionalidad: "Coreano", edad: 24, juegoprof: "League of Legends", primerequipo: "DRX" },
  { nombre: "Canyon",    equipo: "Gen.G",         nacionalidad: "Coreano", edad: 23, juegoprof: "League of Legends", primerequipo: "DAMWON Gaming" },
  { nombre: "Chovy",     equipo: "Gen.G",         nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "DragonX" },
  { nombre: "Duro",      equipo: "Gen.G",         nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "Fredit BRION" },
  { nombre: "Siwoo",     equipo: "Dplus KIA",     nacionalidad: "Coreano", edad: 16, juegoprof: "League of Legends", primerequipo: "DAMWON Gaming" },
  { nombre: "Lucid",     equipo: "Dplus KIA",     nacionalidad: "Coreano", edad: 20, juegoprof: "League of Legends", primerequipo: "DAMWON Gaming" },
  { nombre: "ShowMaker", equipo: "Dplus KIA",     nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "DAMWON Gaming" },
  { nombre: "Aiming",    equipo: "Dplus KIA",     nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "APK Prince" },
  { nombre: "BeryL",     equipo: "Dplus KIA",     nacionalidad: "Coreano", edad: 23, juegoprof: "League of Legends", primerequipo: "DAMWON Gaming" },
  { nombre: "PerfecT",   equipo: "KT Rolster",    nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "KT Rolster" },
  { nombre: "Cuzz",      equipo: "KT Rolster",    nacionalidad: "Coreano", edad: 23, juegoprof: "League of Legends", primerequipo: "KT Rolster" },
  { nombre: "Bdd",       equipo: "KT Rolster",    nacionalidad: "Coreano", edad: 24, juegoprof: "League of Legends", primerequipo: "KT Rolster" },
  { nombre: "Deokdam",   equipo: "KT Rolster",    nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "DRX" },
  { nombre: "Way",       equipo: "KT Rolster",    nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "KT Rolster" },
  { nombre: "Zeus",      equipo: "Hanwha Life",   nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "T1" },
  { nombre: "Peanut",    equipo: "Hanwha Life",   nacionalidad: "Coreano", edad: 24, juegoprof: "League of Legends", primerequipo: "SK Telecom T1" },
  { nombre: "Zeka",      equipo: "Hanwha Life",   nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "DRX" },
  { nombre: "Viper",     equipo: "Hanwha Life",   nacionalidad: "Coreano", edad: 23, juegoprof: "League of Legends", primerequipo: "Samsung Galaxy" },
  { nombre: "Delight",   equipo: "Hanwha Life",   nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "DRX" },
  { nombre: "Rich",      equipo: "DRX",           nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "Dignitas" },
  { nombre: "Juhan",     equipo: "DRX",           nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "GIANTX" },
  { nombre: "Sponge",    equipo: "DRX",           nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "DRX" },
  { nombre: "Ucal",      equipo: "DRX",           nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "ThunderTalk" },
  { nombre: "Andil",     equipo: "DRX",           nacionalidad: "Coreano", edad: 20, juegoprof: "League of Legends", primerequipo: "Kwangdong Freecs" },
  { nombre: "Kingen",   equipo: "Nongshim RedForce", nacionalidad: "Coreano", edad: 24, juegoprof: "League of Legends", primerequipo: "DRX" },
  { nombre: "Sylvie",   equipo: "Nongshim RedForce", nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "KT Rolster" },
  { nombre: "Calix",    equipo: "Nongshim RedForce", nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "Kwangdong Freecs" },
  { nombre: "Fisher",   equipo: "Nongshim RedForce", nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "Kwangdong Freecs" },
  { nombre: "Jiwoo",    equipo: "Nongshim RedForce", nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "Kwangdong Freecs" },
  { nombre: "Clear",    equipo: "BNK FearX", nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "T1" },
  { nombre: "Raptor",   equipo: "BNK FearX", nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "KT Rolster" },
  { nombre: "VicLa",    equipo: "BNK FearX", nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "FlyQuest" },
  { nombre: "Diable",   equipo: "BNK FearX", nacionalidad: "Coreano", edad: 20, juegoprof: "League of Legends", primerequipo: "BNK FearX Youth" },
  { nombre: "Kellin",   equipo: "BNK FearX", nacionalidad: "Coreano", edad: 23, juegoprof: "League of Legends", primerequipo: "Dplus KIA" },
  { nombre: "DuDu",     equipo: "DN Freecs", nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "Kwangdong Freecs" },
  { nombre: "Pyosik",   equipo: "DN Freecs", nacionalidad: "Coreano", edad: 23, juegoprof: "League of Legends", primerequipo: "KT Rolster" },
  { nombre: "BuLLDoG",  equipo: "DN Freecs", nacionalidad: "Coreano", edad: 21, juegoprof: "League of Legends", primerequipo: "Kwangdong Freecs" },
  { nombre: "Berserker",equipo: "DN Freecs", nacionalidad: "Coreano", edad: 22, juegoprof: "League of Legends", primerequipo: "Cloud9" },
  { nombre: "Life",     equipo: "DN Freecs", nacionalidad: "Coreano", edad: 23, juegoprof: "League of Legends", primerequipo: "FunPlus Phoenix" }
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
