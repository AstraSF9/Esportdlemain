// controllers/authController.js
const crypto = require('crypto');
const db = require('../db');

// Utilidades scrypt
function scryptHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey);
    });
  });
}
function timingSafeEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Token simple (sin libs externas)
const SECRET = process.env.ESPORTDLE_SECRET || 'cambia-esta-clave-super-secreta';
function signToken(userId) {
  const ts = Date.now().toString();
  const base = `${userId}.${ts}`;
  const sig = crypto.createHmac('sha256', SECRET).update(base).digest('base64url');
  return Buffer.from(`${base}.${sig}`).toString('base64url');
}
function verifyToken(tokenB64) {
  try {
    const raw = Buffer.from(tokenB64, 'base64url').toString();
    const [id, ts, sig] = raw.split('.');
    const base = `${id}.${ts}`;
    const expected = crypto.createHmac('sha256', SECRET).update(base).digest('base64url');
    if (sig !== expected) return null;
    return { id: parseInt(id, 10), ts: parseInt(ts, 10) };
  } catch {
    return null;
  }
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: 'Faltan campos' });
    }

    db.query(
      'SELECT id_usuarios FROM usuarios WHERE email = ? OR nombre_usuario = ? LIMIT 1',
      [email, username],
      async (err, rows) => {
        if (err) return res.status(500).json({ ok: false, error: 'DB error' });
        if (rows.length > 0) {
          return res.status(409).json({ ok: false, error: 'Usuario o email ya registrados' });
        }

        const salt = crypto.randomBytes(16);
        const hash = await scryptHash(password, salt);

        db.query(
          'INSERT INTO usuarios (nombre_usuario, email, pass_hash, pass_salt) VALUES (?, ?, ?, ?)',
          [username, email, hash, salt],
          (err2, result) => {
            if (err2) return res.status(500).json({ ok: false, error: 'DB error' });
            const newId = result.insertId;

            // Leer role real desde la BD
            db.query(
              'SELECT id_usuarios, nombre_usuario, email, role FROM usuarios WHERE id_usuarios = ? LIMIT 1',
              [newId],
              (e3, r3) => {
                if (e3 || r3.length === 0) {
                  const token = signToken(newId);
                  return res.status(201).json({
                    ok: true,
                    user: { id: newId, username, email, role: 'user' },
                    token
                  });
                }
                const u = r3[0];
                const token = signToken(u.id_usuarios);
                res.status(201).json({
                  ok: true,
                  user: { id: u.id_usuarios, username: u.nombre_usuario, email: u.email, role: u.role || 'user' },
                  token
                });
              }
            );
          }
        );
      }
    );
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Error interno' });
  }
};

// POST /api/auth/login
exports.login = (req, res) => {
  const { emailOrUser, password } = req.body || {};
  if (!emailOrUser || !password) {
    return res.status(400).json({ ok: false, error: 'Faltan campos' });
  }

  db.query(
    // ⤵️ añadimos role
    'SELECT id_usuarios, nombre_usuario, email, pass_hash, pass_salt, role FROM usuarios WHERE email = ? OR nombre_usuario = ? LIMIT 1',
    [emailOrUser, emailOrUser],
    async (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: 'DB error' });
      if (rows.length === 0) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });

      const u = rows[0];
      try {
        if (!u.pass_hash || !u.pass_salt) {
          return res.status(403).json({ ok: false, error: 'Cuenta sin contraseña. Debe registrarse nuevamente o restablecer.' });
        }

        const hash = await scryptHash(password, u.pass_salt);
        const ok = timingSafeEqual(hash, u.pass_hash);
        if (!ok) return res.status(401).json({ ok: false, error: 'Credenciales inválidas' });

        const token = signToken(u.id_usuarios);
        res.json({
          ok: true,
          user: { id: u.id_usuarios, username: u.nombre_usuario, email: u.email, role: u.role || 'user' },
          token
        });
      } catch {
        res.status(500).json({ ok: false, error: 'Error interno' });
      }
    }
  );
};

// GET /api/auth/me
exports.me = (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: 'No token' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ ok: false, error: 'Token inválido' });

  db.query(
    // ⤵️ añadimos role
    'SELECT id_usuarios, nombre_usuario, email, role FROM usuarios WHERE id_usuarios = ? LIMIT 1',
    [payload.id],
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: 'DB error' });
      if (rows.length === 0) return res.status(404).json({ ok: false, error: 'No encontrado' });
      const u = rows[0];
      res.json({
        ok: true,
        user: { id: u.id_usuarios, username: u.nombre_usuario, email: u.email, role: u.role || 'user' }
      });
    }
  );
};
