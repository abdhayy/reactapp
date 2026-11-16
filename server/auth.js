// Accounts and login sessions.
const crypto = require('crypto');
const db = require('./db');

const COOKIE = 'sid';
const SESSION_DAYS = 30;

// ---------- Passwords (scrypt, built into Node) ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [, salt, hash] = stored.split('$');
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// A real hash to compare against when the username doesn't exist,
// so a wrong username takes as long as a wrong password.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

// ---------- Sessions ----------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(sha256(token), userId, expires.toISOString());
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', expires, path: '/' });
}

function readToken(req) {
  const cookies = Object.fromEntries(
    (req.headers.cookie || '').split(';').map((c) => c.trim().split('=').map(decodeURIComponent)).filter((c) => c[0])
  );
  return cookies[COOKIE];
}

// Express middleware: sets req.user or answers 401
function requireUser(req, res, next) {
  const token = readToken(req);
  const row = token && db.prepare(
    `SELECT u.id, u.username, u.name, u.calorie_goal FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  ).get(sha256(token), new Date().toISOString());
  if (!row) return res.status(401).json({ error: 'Please log in' });
  req.user = row;
  next();
}

// ---------- Slow down password guessing ----------
const failures = new Map(); // key -> { count, until }
const LIMIT = 8, WINDOW_MS = 15 * 60 * 1000;
const tooManyAttempts = (key) => {
  const f = failures.get(key);
  return f && f.count >= LIMIT && f.until > Date.now();
};
const recordFailure = (key) => {
  const f = failures.get(key);
  if (!f || f.until < Date.now()) failures.set(key, { count: 1, until: Date.now() + WINDOW_MS });
  else f.count++;
};

const publicUser = (u) => ({ id: u.id, username: u.username, name: u.name, calorie_goal: u.calorie_goal });

// ---------- Routes ----------
function mountAuthRoutes(app) {
  app.post('/api/auth/register', (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const name = String(req.body.name || '').trim();
    const password = String(req.body.password || '');
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
      return res.status(400).json({ error: 'Username: 3–30 letters, numbers, _ or .' });
    }
    if (!name) return res.status(400).json({ error: 'Please enter your name' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
      return res.status(409).json({ error: 'That username is taken' });
    }

    const isFirst = !db.prepare('SELECT 1 FROM users LIMIT 1').get();
    const info = db.prepare('INSERT INTO users (username, name, password_hash) VALUES (?, ?, ?)')
      .run(username, name, hashPassword(password));
    const userId = Number(info.lastInsertRowid);
    if (isFirst) db.claimOldData(userId);

    startSession(res, userId);
    res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)));
  });

  app.post('/api/auth/login', (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const key = `${req.ip}|${username}`;
    if (tooManyAttempts(key)) {
      return res.status(429).json({ error: 'Too many wrong tries. Wait 15 minutes and try again.' });
    }
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH) && user;
    if (!ok) {
      recordFailure(key);
      return res.status(401).json({ error: 'Wrong username or password' });
    }
    failures.delete(key);
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
    startSession(res, user.id);
    res.json(publicUser(user));
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = readToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    res.clearCookie(COOKIE, { path: '/' });
    res.status(204).end();
  });

  app.get('/api/auth/me', requireUser, (req, res) => res.json(publicUser(req.user)));

  // Change name / password
  app.put('/api/auth/me', requireUser, (req, res) => {
    const { name, current_password, new_password } = req.body;
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ error: 'Name cannot be empty' });
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim(), req.user.id);
    }
    if (new_password !== undefined) {
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
      if (!verifyPassword(String(current_password || ''), user.password_hash)) {
        return res.status(400).json({ error: 'Current password is wrong' });
      }
      if (String(new_password).length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(new_password)), req.user.id);
    }
    res.json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
  });
}

module.exports = { requireUser, mountAuthRoutes };
