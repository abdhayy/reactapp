// SQLite database setup. The whole database lives in the file health.db.
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'health.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- Accounts
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    username       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    name           TEXT    NOT NULL,
    password_hash  TEXT    NOT NULL,               -- scrypt hash, never the real password
    calorie_goal   INTEGER NOT NULL DEFAULT 2000,
    created_at     TEXT    DEFAULT (datetime('now'))
  );

  -- Logged-in sessions (the browser keeps a cookie with the token)
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT    PRIMARY KEY,               -- sha256 of the cookie token
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TEXT    NOT NULL
  );

  -- Every food you eat
  CREATE TABLE IF NOT EXISTS meals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date        TEXT    NOT NULL,              -- 'YYYY-MM-DD'
    meal_type   TEXT    NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
    food_name   TEXT    NOT NULL,
    calories    INTEGER NOT NULL CHECK (calories >= 0),
    protein_g   REAL    DEFAULT 0,
    carbs_g     REAL    DEFAULT 0,
    fat_g       REAL    DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  -- Workout checklist items for a given day
  CREATE TABLE IF NOT EXISTS workouts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date             TEXT    NOT NULL,
    exercise         TEXT    NOT NULL,
    sets             INTEGER,
    reps             INTEGER,
    duration_min     INTEGER,
    calories_burned  INTEGER DEFAULT 0,
    done             INTEGER NOT NULL DEFAULT 0,  -- 0 = not done, 1 = done
    created_at       TEXT    DEFAULT (datetime('now'))
  );
`);

// ---------- Upgrade databases created by older versions of the app ----------
const hasColumn = (table, col) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);

for (const table of ['meals', 'workouts']) {
  if (!hasColumn(table, 'user_id')) {
    // Old single-user data: user_id stays NULL until the first account claims it
    db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
  }
}

// Food list. user_id = 0 for built-in foods everyone sees, otherwise the owner's id.
// (-1 = custom foods from before accounts existed, claimed by the first account.)
const FOODS_SQL = `
  CREATE TABLE IF NOT EXISTS foods (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL DEFAULT 0,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL DEFAULT 'Lain-lain',
    serving     TEXT    NOT NULL DEFAULT '1 hidangan',
    calories    INTEGER NOT NULL CHECK (calories >= 0),
    protein_g   REAL    DEFAULT 0,
    carbs_g     REAL    DEFAULT 0,
    fat_g       REAL    DEFAULT 0,
    source      TEXT    NOT NULL DEFAULT 'builtin' CHECK (source IN ('builtin','custom','ai')),
    UNIQUE (user_id, name)
  )`;
const foodsExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='foods'").get();
if (foodsExists && !hasColumn('foods', 'user_id')) {
  db.transaction(() => {
    db.exec('ALTER TABLE foods RENAME TO foods_old');
    db.exec(FOODS_SQL);
    db.exec(`INSERT INTO foods (user_id, name, category, serving, calories, protein_g, carbs_g, fat_g, source)
             SELECT CASE WHEN source = 'builtin' THEN 0 ELSE -1 END,
                    name, category, serving, calories, protein_g, carbs_g, fat_g, source FROM foods_old`);
    db.exec('DROP TABLE foods_old');
  })();
} else {
  db.exec(FOODS_SQL);
}

// Body profile for the calorie calculator (added later, so add columns if missing)
for (const [col, type] of [
  ['sex', "TEXT CHECK (sex IN ('male','female'))"],
  ['birth_year', 'INTEGER'],
  ['height_cm', 'REAL'],
  ['activity', 'TEXT'],
  ['goal_weight_kg', 'REAL'],           // long-term goal weight
]) {
  if (!hasColumn('users', col)) db.exec(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
}

db.exec(`
  -- Weight log (one entry per day)
  CREATE TABLE IF NOT EXISTS weights (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date        TEXT    NOT NULL,
    weight_kg   REAL    NOT NULL CHECK (weight_kg BETWEEN 20 AND 400),
    UNIQUE (user_id, date)
  );

  -- Target weight for each month ('YYYY-MM')
  CREATE TABLE IF NOT EXISTS monthly_targets (
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month             TEXT    NOT NULL,
    target_weight_kg  REAL    NOT NULL CHECK (target_weight_kg BETWEEN 20 AND 400),
    start_weight_kg   REAL,                 -- weight when the target was set
    PRIMARY KEY (user_id, month)
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date);
`);

// Fill the built-in food list (and add any new built-in foods later)
const insertFood = db.prepare(
  `INSERT OR IGNORE INTO foods (user_id, name, category, serving, calories, protein_g, carbs_g, fat_g, source)
   VALUES (0, ?, ?, ?, ?, ?, ?, ?, 'builtin')`
);
db.transaction((rows) => rows.forEach((r) => insertFood.run(...r)))(require('./foods-seed'));

// Give data logged before accounts existed to the first account that is created
db.claimOldData = (userId) => {
  db.transaction(() => {
    db.prepare('UPDATE meals SET user_id = ? WHERE user_id IS NULL').run(userId);
    db.prepare('UPDATE workouts SET user_id = ? WHERE user_id IS NULL').run(userId);
    db.prepare('UPDATE foods SET user_id = ? WHERE user_id = -1').run(userId);
    const old = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='settings'").get();
    if (old) {
      const s = db.prepare('SELECT calorie_goal FROM settings WHERE id = 1').get();
      if (s) db.prepare('UPDATE users SET calorie_goal = ? WHERE id = ?').run(s.calorie_goal, userId);
      db.exec('DROP TABLE settings');
    }
  })();
};

module.exports = db;
