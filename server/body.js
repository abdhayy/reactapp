// Body profile, weight log, monthly targets and the calorie suggestion.
const db = require('./db');
const { calculatePlan, ACTIVITY } = require('./plan');

const localDate = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD
const thisMonth = () => localDate().slice(0, 7); // YYYY-MM

const num = (v) => (v === '' || v == null ? null : Number(v));

function latestWeight(userId) {
  return db.prepare('SELECT weight_kg, date FROM weights WHERE user_id = ? ORDER BY date DESC LIMIT 1').get(userId);
}

function bodyState(userId) {
  const user = db.prepare(
    'SELECT calorie_goal, sex, birth_year, height_cm, activity, goal_weight_kg FROM users WHERE id = ?'
  ).get(userId);
  const latest = latestWeight(userId);
  const weights = db.prepare(
    "SELECT id, date, weight_kg FROM weights WHERE user_id = ? AND date >= date('now', 'localtime', '-180 days') ORDER BY date"
  ).all(userId);
  const month = thisMonth();
  const target = db.prepare('SELECT * FROM monthly_targets WHERE user_id = ? AND month = ?').get(userId, month);

  // Past months: did you reach the target? (last weight logged in that month)
  const history = db.prepare(`
    SELECT t.month, t.target_weight_kg, t.start_weight_kg,
      (SELECT weight_kg FROM weights w WHERE w.user_id = t.user_id AND substr(w.date, 1, 7) = t.month
       ORDER BY w.date DESC LIMIT 1) AS end_weight_kg
    FROM monthly_targets t WHERE t.user_id = ? AND t.month < ? ORDER BY t.month DESC LIMIT 12
  `).all(userId, month).map((h) => {
    const losing = h.start_weight_kg == null || h.target_weight_kg <= h.start_weight_kg;
    const achieved = h.end_weight_kg == null ? null
      : losing ? h.end_weight_kg <= h.target_weight_kg + 0.05 : h.end_weight_kg >= h.target_weight_kg - 0.05;
    return { ...h, achieved };
  });

  const { calorie_goal, ...profile } = user;
  return {
    profile,
    calorie_goal,
    current_weight: latest?.weight_kg ?? null,
    current_weight_date: latest?.date ?? null,
    weights,
    month,
    month_target: target || null,
    history,
    plan: calculatePlan(profile, latest?.weight_kg, target?.target_weight_kg ?? null),
    activity_levels: Object.entries(ACTIVITY).map(([id, a]) => ({ id, label: a.label })),
  };
}

function mountBodyRoutes(app) {
  app.get('/api/body', (req, res) => res.json(bodyState(req.user.id)));

  app.put('/api/body/profile', (req, res) => {
    const { sex, birth_year, height_cm, activity, goal_weight_kg } = req.body;
    const year = new Date().getFullYear();
    const p = { sex: sex || null, birth_year: num(birth_year), height_cm: num(height_cm), activity: activity || null, goal_weight_kg: num(goal_weight_kg) };
    if (p.sex && !['male', 'female'].includes(p.sex)) return res.status(400).json({ error: 'Choose male or female' });
    if (p.birth_year && (p.birth_year < year - 100 || p.birth_year > year - 13)) return res.status(400).json({ error: 'Birth year looks wrong (age 13–100)' });
    if (p.height_cm && (p.height_cm < 100 || p.height_cm > 250)) return res.status(400).json({ error: 'Height must be 100–250 cm' });
    if (p.activity && !ACTIVITY[p.activity]) return res.status(400).json({ error: 'Choose an activity level' });
    if (p.goal_weight_kg && (p.goal_weight_kg < 30 || p.goal_weight_kg > 300)) return res.status(400).json({ error: 'Goal weight must be 30–300 kg' });
    db.prepare('UPDATE users SET sex = ?, birth_year = ?, height_cm = ?, activity = ?, goal_weight_kg = ? WHERE id = ?')
      .run(p.sex, p.birth_year, p.height_cm, p.activity, p.goal_weight_kg, req.user.id);
    res.json(bodyState(req.user.id));
  });

  // Log weight (one per day; logging again on the same day replaces it)
  app.post('/api/body/weights', (req, res) => {
    const w = num(req.body.weight_kg);
    const date = req.body.date || localDate();
    if (!w || w < 20 || w > 400) return res.status(400).json({ error: 'Weight must be 20–400 kg' });
    if (date > localDate()) return res.status(400).json({ error: 'Cannot log weight for a future date' });
    db.prepare(
      `INSERT INTO weights (user_id, date, weight_kg) VALUES (?, ?, ?)
       ON CONFLICT(user_id, date) DO UPDATE SET weight_kg = excluded.weight_kg`
    ).run(req.user.id, date, w);
    res.status(201).json(bodyState(req.user.id));
  });

  app.delete('/api/body/weights/:id', (req, res) => {
    db.prepare('DELETE FROM weights WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json(bodyState(req.user.id));
  });

  // Set (or change) this month's target weight
  app.put('/api/body/target', (req, res) => {
    const t = num(req.body.target_weight_kg);
    if (!t || t < 20 || t > 400) return res.status(400).json({ error: 'Target must be 20–400 kg' });
    const start = latestWeight(req.user.id)?.weight_kg ?? null;
    if (start == null) return res.status(400).json({ error: 'Log your current weight first' });
    db.prepare(
      `INSERT INTO monthly_targets (user_id, month, target_weight_kg, start_weight_kg) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, month) DO UPDATE SET target_weight_kg = excluded.target_weight_kg`
    ).run(req.user.id, thisMonth(), t, start);
    res.json(bodyState(req.user.id));
  });

  app.delete('/api/body/target', (req, res) => {
    db.prepare('DELETE FROM monthly_targets WHERE user_id = ? AND month = ?').run(req.user.id, thisMonth());
    res.json(bodyState(req.user.id));
  });

  // Use the suggested intake as the daily calorie goal
  app.post('/api/body/apply-suggestion', (req, res) => {
    const state = bodyState(req.user.id);
    if (!state.plan.ready) return res.status(400).json({ error: 'Fill in your body profile first' });
    db.prepare('UPDATE users SET calorie_goal = ? WHERE id = ?').run(state.plan.suggested, req.user.id);
    res.json(bodyState(req.user.id));
  });
}

module.exports = { mountBodyRoutes };
