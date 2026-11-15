// REST API for the health app.
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

// ---------- Settings ----------
app.get('/api/settings', (req, res) => {
  res.json(db.prepare('SELECT calorie_goal FROM settings WHERE id = 1').get());
});

app.put('/api/settings', (req, res) => {
  const goal = parseInt(req.body.calorie_goal, 10);
  if (!goal || goal < 500) return res.status(400).json({ error: 'Goal must be at least 500' });
  db.prepare('UPDATE settings SET calorie_goal = ? WHERE id = 1').run(goal);
  res.json({ calorie_goal: goal });
});

// ---------- Meals ----------
app.get('/api/meals', (req, res) => {
  const date = req.query.date || today();
  res.json(db.prepare('SELECT * FROM meals WHERE date = ? ORDER BY id').all(date));
});

app.post('/api/meals', (req, res) => {
  const { date = today(), meal_type, food_name, calories, protein_g = 0, carbs_g = 0, fat_g = 0 } = req.body;
  if (!food_name || calories == null || !meal_type) {
    return res.status(400).json({ error: 'food_name, calories and meal_type are required' });
  }
  try {
    const info = db.prepare(
      `INSERT INTO meals (date, meal_type, food_name, calories, protein_g, carbs_g, fat_g)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(date, meal_type, food_name, calories, protein_g, carbs_g, fat_g);
    res.status(201).json(db.prepare('SELECT * FROM meals WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.delete('/api/meals/:id', (req, res) => {
  db.prepare('DELETE FROM meals WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- Workouts ----------
app.get('/api/workouts', (req, res) => {
  const date = req.query.date || today();
  res.json(db.prepare('SELECT * FROM workouts WHERE date = ? ORDER BY id').all(date));
});

app.post('/api/workouts', (req, res) => {
  const { date = today(), exercise, sets = null, reps = null, duration_min = null, calories_burned = 0 } = req.body;
  if (!exercise) return res.status(400).json({ error: 'exercise is required' });
  const info = db.prepare(
    `INSERT INTO workouts (date, exercise, sets, reps, duration_min, calories_burned)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(date, exercise, sets, reps, duration_min, calories_burned);
  res.status(201).json(db.prepare('SELECT * FROM workouts WHERE id = ?').get(info.lastInsertRowid));
});

// Tick / untick a workout
app.patch('/api/workouts/:id/toggle', (req, res) => {
  db.prepare('UPDATE workouts SET done = 1 - done WHERE id = ?').run(req.params.id);
  res.json(db.prepare('SELECT * FROM workouts WHERE id = ?').get(req.params.id));
});

app.delete('/api/workouts/:id', (req, res) => {
  db.prepare('DELETE FROM workouts WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Copy yesterday's (or any day's) workout list into a new date, unchecked
app.post('/api/workouts/copy', (req, res) => {
  const { from, to = today() } = req.body;
  const n = db.prepare(
    `INSERT INTO workouts (date, exercise, sets, reps, duration_min, calories_burned)
     SELECT ?, exercise, sets, reps, duration_min, calories_burned FROM workouts WHERE date = ?`
  ).run(to, from).changes;
  res.json({ copied: n });
});

// ---------- Summary (last 7 days) ----------
app.get('/api/summary', (req, res) => {
  const rows = db.prepare(`
    WITH RECURSIVE days(d) AS (
      SELECT date('now', 'localtime', '-6 days') UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < date('now', 'localtime')
    )
    SELECT d AS date,
      (SELECT COALESCE(SUM(calories), 0) FROM meals WHERE date = d) AS eaten,
      (SELECT COALESCE(SUM(calories_burned), 0) FROM workouts WHERE date = d AND done = 1) AS burned,
      (SELECT COUNT(*) FROM workouts WHERE date = d) AS workouts_total,
      (SELECT COUNT(*) FROM workouts WHERE date = d AND done = 1) AS workouts_done
    FROM days ORDER BY d
  `).all();
  res.json(rows);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
