import { useState } from 'react';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const empty = { food_name: '', calories: '', meal_type: 'breakfast', protein_g: '', carbs_g: '', fat_g: '' };

export default function CalorieTracker({ date, meals, goal, eaten, onAdd, onDelete, onGoal }) {
  const [form, setForm] = useState(empty);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(goal);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.food_name || form.calories === '') return;
    onAdd({
      date,
      meal_type: form.meal_type,
      food_name: form.food_name.trim(),
      calories: Number(form.calories),
      protein_g: Number(form.protein_g) || 0,
      carbs_g: Number(form.carbs_g) || 0,
      fat_g: Number(form.fat_g) || 0,
    });
    setForm({ ...empty, meal_type: form.meal_type });
  };

  const pct = Math.min(100, Math.round((eaten / goal) * 100));
  const totals = meals.reduce(
    (t, m) => ({ p: t.p + m.protein_g, c: t.c + m.carbs_g, f: t.f + m.fat_g }),
    { p: 0, c: 0, f: 0 }
  );

  return (
    <div className="card">
      <div className="card-head">
        <h2>🍽️ Calorie Intake</h2>
        {editingGoal ? (
          <span>
            <input type="number" className="small" value={goalInput} onChange={(e) => setGoalInput(e.target.value)} />
            <button onClick={() => { onGoal(Number(goalInput)); setEditingGoal(false); }}>Save</button>
          </span>
        ) : (
          <button className="link" onClick={() => { setGoalInput(goal); setEditingGoal(true); }}>Edit goal</button>
        )}
      </div>

      <div className="progress"><div className={eaten > goal ? 'over' : ''} style={{ width: pct + '%' }} /></div>
      <p className="muted">{eaten} / {goal} kcal · P {totals.p.toFixed(0)}g · C {totals.c.toFixed(0)}g · F {totals.f.toFixed(0)}g</p>

      <form onSubmit={submit} className="form">
        <input placeholder="Food (e.g. Nasi lemak)" value={form.food_name} onChange={set('food_name')} required />
        <input type="number" min="0" placeholder="kcal" value={form.calories} onChange={set('calories')} required />
        <select value={form.meal_type} onChange={set('meal_type')}>
          {MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input type="number" min="0" placeholder="Protein g" value={form.protein_g} onChange={set('protein_g')} />
        <input type="number" min="0" placeholder="Carbs g" value={form.carbs_g} onChange={set('carbs_g')} />
        <input type="number" min="0" placeholder="Fat g" value={form.fat_g} onChange={set('fat_g')} />
        <button type="submit">Add food</button>
      </form>

      {MEAL_TYPES.map((type) => {
        const items = meals.filter((m) => m.meal_type === type);
        if (!items.length) return null;
        return (
          <div key={type}>
            <h3><span className="cap">{type}</span> <span className="muted">({items.reduce((s, m) => s + m.calories, 0)} kcal)</span></h3>
            <ul className="list">
              {items.map((m) => (
                <li key={m.id}>
                  <span>{m.food_name}</span>
                  <span className="muted">{m.calories} kcal</span>
                  <button className="del" onClick={() => onDelete(m.id)} aria-label="Delete">✕</button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {!meals.length && <p className="muted">No food logged for this day yet.</p>}
    </div>
  );
}
