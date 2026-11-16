// REST API for the health app.
require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const express = require('express');
const db = require('./db');
const ai = require('./ai');
const { requireUser, mountAuthRoutes } = require('./auth');
const { mountBodyRoutes } = require('./body');

const app = express();
app.use(express.json({ limit: '10mb' })); // room for meal photos

const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

// ---------- Accounts (open to everyone) ----------
mountAuthRoutes(app);

// Everything below needs a logged-in user (req.user)
app.use('/api', requireUser);

// ---------- Settings ----------
app.get('/api/settings', (req, res) => {
  res.json({ calorie_goal: req.user.calorie_goal });
});

app.put('/api/settings', (req, res) => {
  const goal = parseInt(req.body.calorie_goal, 10);
  if (!goal || goal < 500 || goal > 10000) return res.status(400).json({ error: 'Goal must be between 500 and 10000' });
  db.prepare('UPDATE users SET calorie_goal = ? WHERE id = ?').run(goal, req.user.id);
  res.json({ calorie_goal: goal });
});

// ---------- Meals ----------
app.get('/api/meals', (req, res) => {
  const date = req.query.date || today();
  res.json(db.prepare('SELECT * FROM meals WHERE user_id = ? AND date = ? ORDER BY id').all(req.user.id, date));
});

app.post('/api/meals', (req, res) => {
  const { date = today(), meal_type, food_name, calories, protein_g = 0, carbs_g = 0, fat_g = 0 } = req.body;
  if (!food_name || calories == null || !meal_type) {
    return res.status(400).json({ error: 'food_name, calories and meal_type are required' });
  }
  try {
    const info = db.prepare(
      `INSERT INTO meals (user_id, date, meal_type, food_name, calories, protein_g, carbs_g, fat_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(req.user.id, date, meal_type, food_name, calories, protein_g, carbs_g, fat_g);
    res.status(201).json(db.prepare('SELECT * FROM meals WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/meals/:id', (req, res) => {
  db.prepare('DELETE FROM meals WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.status(204).end();
});

// ---------- Exercise (cardio & strength) ----------
const exercises = require('./exercises');

// Latest logged weight, used to calculate calories burned
const userWeight = (userId) =>
  db.prepare('SELECT weight_kg FROM weights WHERE user_id = ? ORDER BY date DESC LIMIT 1').get(userId)?.weight_kg ?? null;

app.get('/api/exercises', (req, res) => {
  const w = userWeight(req.user.id);
  res.json({
    catalog: exercises.list,
    intensities: exercises.INTENSITY,
    minutes_per_set: exercises.MINUTES_PER_SET,
    weight_kg: w ?? exercises.DEFAULT_WEIGHT,
    weight_is_default: w == null,
  });
});

app.get('/api/workouts', (req, res) => {
  const date = req.query.date || today();
  res.json(db.prepare('SELECT * FROM workouts WHERE user_id = ? AND date = ? ORDER BY id').all(req.user.id, date));
});

app.post('/api/workouts', (req, res) => {
  const { date = today(), kind, sets = null, reps = null } = req.body;
  if (!['cardio', 'strength'].includes(kind)) return res.status(400).json({ error: 'kind must be cardio or strength' });
  let calc;
  try {
    calc = exercises.calculate(req.body, userWeight(req.user.id));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const info = db.prepare(
    `INSERT INTO workouts (user_id, date, kind, exercise_key, exercise, met, sets, reps, duration_min, calories_burned)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, date, kind, req.body.exercise_key || null, calc.name, calc.met,
    sets || null, reps || null, Math.round(calc.minutes * 10) / 10, calc.calories);
  res.status(201).json(db.prepare('SELECT * FROM workouts WHERE id = ?').get(info.lastInsertRowid));
});

// Tick / untick
app.patch('/api/workouts/:id/toggle', (req, res) => {
  db.prepare('UPDATE workouts SET done = 1 - done WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  const row = db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

app.delete('/api/workouts/:id', (req, res) => {
  db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.status(204).end();
});

// Copy one day's exercise list into another date, unchecked
app.post('/api/workouts/copy', (req, res) => {
  const { from, to = today(), kind } = req.body;
  const n = db.prepare(
    `INSERT INTO workouts (user_id, date, kind, exercise_key, exercise, met, sets, reps, duration_min, calories_burned)
     SELECT user_id, ?, kind, exercise_key, exercise, met, sets, reps, duration_min, calories_burned
     FROM workouts WHERE user_id = ? AND date = ? AND (? IS NULL OR kind = ?)`
  ).run(to, req.user.id, from, kind || null, kind || null).changes;
  res.json({ copied: n });
});

// ---------- Steps ----------
const stepsFor = (userId, date) => {
  const row = db.prepare('SELECT steps, calories FROM daily_steps WHERE user_id = ? AND date = ?').get(userId, date);
  const goal = db.prepare('SELECT step_goal FROM users WHERE id = ?').get(userId).step_goal;
  return { date, steps: row?.steps ?? 0, calories: row?.calories ?? 0, step_goal: goal };
};

app.get('/api/steps', (req, res) => res.json(stepsFor(req.user.id, req.query.date || today())));

app.put('/api/steps', (req, res) => {
  const { date = today() } = req.body;
  const steps = parseInt(req.body.steps, 10);
  if (!(steps >= 0 && steps <= 100000)) return res.status(400).json({ error: 'Steps must be 0–100,000' });
  if (date > today()) return res.status(400).json({ error: 'Cannot log steps for a future date' });
  const kcal = exercises.stepCalories(steps, userWeight(req.user.id));
  db.prepare(
    `INSERT INTO daily_steps (user_id, date, steps, calories) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET steps = excluded.steps, calories = excluded.calories`
  ).run(req.user.id, date, steps, kcal);
  res.json(stepsFor(req.user.id, date));
});

app.put('/api/steps/goal', (req, res) => {
  const goal = parseInt(req.body.step_goal, 10);
  if (!(goal >= 1000 && goal <= 50000)) return res.status(400).json({ error: 'Step goal must be 1,000–50,000' });
  db.prepare('UPDATE users SET step_goal = ? WHERE id = ?').run(goal, req.user.id);
  res.json(stepsFor(req.user.id, req.body.date || today()));
});

// ---------- Food list (built-in + your own) ----------
app.get('/api/foods', (req, res) => {
  const q = (req.query.q || '').trim();
  const rows = q
    ? db.prepare(
        `SELECT * FROM foods WHERE user_id IN (0, ?) AND (name LIKE ? OR category LIKE ?)
         ORDER BY (name LIKE ?) DESC, length(name) LIMIT 30`
      ).all(req.user.id, `%${q}%`, `%${q}%`, `${q}%`)
    : db.prepare('SELECT * FROM foods WHERE user_id IN (0, ?) ORDER BY category, name').all(req.user.id);
  res.json(rows);
});

// Save a food to your own list (e.g. an AI estimate you want to reuse)
app.post('/api/foods', (req, res) => {
  const { name, category = 'Saya', serving = '1 hidangan', calories, protein_g = 0, carbs_g = 0, fat_g = 0, source = 'custom' } = req.body;
  if (!name || calories == null) return res.status(400).json({ error: 'name and calories are required' });
  const clean = String(name).trim();
  if (db.prepare('SELECT 1 FROM foods WHERE user_id = 0 AND name = ?').get(clean)) {
    return res.status(409).json({ error: `"${clean}" is already in the built-in list` });
  }
  try {
    db.prepare(
      `INSERT INTO foods (user_id, name, category, serving, calories, protein_g, carbs_g, fat_g, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, name) DO UPDATE SET serving = excluded.serving, calories = excluded.calories,
         protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, fat_g = excluded.fat_g`
    ).run(req.user.id, clean, category, serving, Math.round(calories), protein_g, carbs_g, fat_g, source === 'ai' ? 'ai' : 'custom');
    res.status(201).json(db.prepare('SELECT * FROM foods WHERE user_id = ? AND name = ?').get(req.user.id, clean));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/foods/:id', (req, res) => {
  db.prepare('DELETE FROM foods WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.status(204).end();
});

// ---------- AI calorie estimate ----------
app.get('/api/ai/status', (req, res) => res.json({ configured: ai.isConfigured(), provider: ai.provider() }));

app.post('/api/ai/estimate', async (req, res) => {
  const { text, image } = req.body;
  if (!text?.trim() && !image) return res.status(400).json({ error: 'Describe your meal or add a photo.' });
  try {
    res.json(await ai.estimateMeal({ text, image }));
  } catch (e) {
    if (!e.status) console.error(e);
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ---------- Body, weight & monthly targets ----------
mountBodyRoutes(app);

// ---------- Summary (last 7 days) ----------
app.get('/api/summary', (req, res) => {
  const rows = db.prepare(`
    WITH RECURSIVE days(d) AS (
      SELECT date('now', 'localtime', '-6 days') UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < date('now', 'localtime')
    )
    SELECT d AS date,
      (SELECT COALESCE(SUM(calories), 0) FROM meals WHERE user_id = :u AND date = d) AS eaten,
      (SELECT COALESCE(SUM(calories_burned), 0) FROM workouts WHERE user_id = :u AND date = d AND done = 1)
        + (SELECT COALESCE(SUM(calories), 0) FROM daily_steps WHERE user_id = :u AND date = d) AS burned,
      (SELECT COALESCE(SUM(steps), 0) FROM daily_steps WHERE user_id = :u AND date = d) AS steps,
      (SELECT COUNT(*) FROM workouts WHERE user_id = :u AND date = d) AS workouts_total,
      (SELECT COUNT(*) FROM workouts WHERE user_id = :u AND date = d AND done = 1) AS workouts_done
    FROM days ORDER BY d
  `).all({ u: req.user.id });
  res.json(rows);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
