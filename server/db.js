// SQLite database setup. The whole database lives in the file health.db.
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'health.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- User settings (single user for now)
  CREATE TABLE IF NOT EXISTS settings (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    calorie_goal  INTEGER NOT NULL DEFAULT 2000
  );
  INSERT OR IGNORE INTO settings (id, calorie_goal) VALUES (1, 2000);

  -- Every food you eat
  CREATE TABLE IF NOT EXISTS meals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL,              -- 'YYYY-MM-DD'
    meal_type   TEXT    NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
    food_name   TEXT    NOT NULL,
    calories    INTEGER NOT NULL CHECK (calories >= 0),
    protein_g   REAL    DEFAULT 0,
    carbs_g     REAL    DEFAULT 0,
    fat_g       REAL    DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);

  -- Workout checklist items for a given day
  CREATE TABLE IF NOT EXISTS workouts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    date             TEXT    NOT NULL,
    exercise         TEXT    NOT NULL,
    sets             INTEGER,
    reps             INTEGER,
    duration_min     INTEGER,
    calories_burned  INTEGER DEFAULT 0,
    done             INTEGER NOT NULL DEFAULT 0,  -- 0 = not done, 1 = done
    created_at       TEXT    DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);

  -- Food list used for search: built-in Malaysian foods + your own saved foods
  CREATE TABLE IF NOT EXISTS foods (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    category    TEXT    NOT NULL DEFAULT 'Lain-lain',
    serving     TEXT    NOT NULL DEFAULT '1 hidangan',
    calories    INTEGER NOT NULL CHECK (calories >= 0),
    protein_g   REAL    DEFAULT 0,
    carbs_g     REAL    DEFAULT 0,
    fat_g       REAL    DEFAULT 0,
    source      TEXT    NOT NULL DEFAULT 'builtin' CHECK (source IN ('builtin','custom','ai'))
  );
`);

// Fill the food list the first time (and add any new built-in foods later)
const insertFood = db.prepare(
  `INSERT OR IGNORE INTO foods (name, category, serving, calories, protein_g, carbs_g, fat_g, source)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'builtin')`
);
db.transaction((rows) => rows.forEach((r) => insertFood.run(...r)))(require('./foods-seed'));

module.exports = db;
