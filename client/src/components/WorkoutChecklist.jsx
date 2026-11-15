import { useState } from 'react';

const empty = { exercise: '', sets: '', reps: '', duration_min: '', calories_burned: '' };
const num = (v) => (v === '' ? null : Number(v));

export default function WorkoutChecklist({ date, workouts, onAdd, onToggle, onDelete, onCopyYesterday }) {
  const [form, setForm] = useState(empty);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.exercise.trim()) return;
    onAdd({
      date,
      exercise: form.exercise.trim(),
      sets: num(form.sets),
      reps: num(form.reps),
      duration_min: num(form.duration_min),
      calories_burned: Number(form.calories_burned) || 0,
    });
    setForm(empty);
  };

  const done = workouts.filter((w) => w.done).length;

  const detail = (w) =>
    [w.sets && w.reps && `${w.sets}×${w.reps}`, w.duration_min && `${w.duration_min} min`, w.calories_burned && `${w.calories_burned} kcal`]
      .filter(Boolean).join(' · ');

  return (
    <div className="card">
      <div className="card-head">
        <h2>🏋️ Workout Checklist</h2>
        <span className="muted">{done}/{workouts.length} done</span>
      </div>

      <div className="progress"><div className="green" style={{ width: workouts.length ? (done / workouts.length) * 100 + '%' : 0 }} /></div>

      <form onSubmit={submit} className="form">
        <input placeholder="Exercise (e.g. Push-ups)" value={form.exercise} onChange={set('exercise')} required />
        <input type="number" min="0" placeholder="Sets" value={form.sets} onChange={set('sets')} />
        <input type="number" min="0" placeholder="Reps" value={form.reps} onChange={set('reps')} />
        <input type="number" min="0" placeholder="Minutes" value={form.duration_min} onChange={set('duration_min')} />
        <input type="number" min="0" placeholder="kcal burned" value={form.calories_burned} onChange={set('calories_burned')} />
        <button type="submit">Add exercise</button>
      </form>

      <ul className="list">
        {workouts.map((w) => (
          <li key={w.id} className={w.done ? 'done' : ''}>
            <label>
              <input type="checkbox" checked={!!w.done} onChange={() => onToggle(w.id)} />
              <span>{w.exercise}</span>
            </label>
            <span className="muted">{detail(w)}</span>
            <button className="del" onClick={() => onDelete(w.id)} aria-label="Delete">✕</button>
          </li>
        ))}
      </ul>

      {!workouts.length && (
        <p className="muted">
          No workouts planned. <button className="link" onClick={onCopyYesterday}>Copy previous day's list</button>
        </p>
      )}
    </div>
  );
}
