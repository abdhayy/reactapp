import { useEffect, useState } from 'react';
import { api } from '../api';

const KINDS = [
  { id: 'cardio', icon: '🏃', label: 'Cardio' },
  { id: 'strength', icon: '💪', label: 'Strength' },
];

export default function ExercisePage({ date, workouts, steps, burned, onAdd, onToggle, onDelete, onCopy, onSaveSteps, onStepGoal }) {
  const [kind, setKind] = useState('cardio');
  const [info, setInfo] = useState(null); // exercise list + body weight

  useEffect(() => { api.getExercises().then(setInfo).catch(() => {}); }, []);

  const exerciseKcal = workouts.filter((w) => w.done).reduce((s, w) => s + w.calories_burned, 0);
  const done = workouts.filter((w) => w.done).length;

  return (
    <div className="narrow">
      <div className="summary-bar card burn-bar">
        <div>
          <strong>🔥 {burned} kcal</strong> <span className="muted">burned</span>
          <div className="muted tiny">Exercise {exerciseKcal} + steps {steps.calories}</div>
        </div>
        <div className="muted">{done}/{workouts.length} exercises done</div>
      </div>

      <StepsCard steps={steps} onSave={onSaveSteps} onGoal={onStepGoal} />

      <div className="segmented big">
        {KINDS.map((k) => {
          const n = workouts.filter((w) => w.kind === k.id).length;
          return (
            <button key={k.id} className={kind === k.id ? 'active' : ''} onClick={() => setKind(k.id)}>
              {k.icon} {k.label} {n > 0 && <span className="count">{n}</span>}
            </button>
          );
        })}
      </div>

      <ExerciseList
        key={kind} kind={kind} date={date} info={info}
        items={workouts.filter((w) => w.kind === kind)}
        onAdd={onAdd} onToggle={onToggle} onDelete={onDelete} onCopy={() => onCopy(kind)}
      />
    </div>
  );
}

// ---------- Steps ----------
function StepsCard({ steps, onSave, onGoal }) {
  const [value, setValue] = useState('');
  const [editGoal, setEditGoal] = useState(false);
  const [goal, setGoal] = useState(steps.step_goal);
  const pct = Math.min(100, Math.round((steps.steps / steps.step_goal) * 100));

  const save = async (e) => {
    e.preventDefault();
    if (value === '') return;
    if (await onSave(Number(value))) setValue('');
  };

  return (
    <div className="card steps">
      <div className="card-head">
        <h2>👟 Steps</h2>
        {editGoal ? (
          <span className="inline-form tight">
            <input type="number" min="1000" max="50000" step="500" value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="Step goal" />
            <button onClick={async () => { if (await onGoal(Number(goal))) setEditGoal(false); }}>Save</button>
          </span>
        ) : (
          <button className="link" onClick={() => { setGoal(steps.step_goal); setEditGoal(true); }}>Goal: {steps.step_goal.toLocaleString()}</button>
        )}
      </div>
      <div className="steps-row">
        <div className="steps-num">{steps.steps.toLocaleString()}<span> / {steps.step_goal.toLocaleString()}</span></div>
        <div className="muted">🔥 {steps.calories} kcal</div>
      </div>
      <div className="progress"><div className="green" style={{ width: pct + '%' }} /></div>
      <form className="inline-form" onSubmit={save}>
        <input type="number" min="0" max="100000" placeholder="Steps (from phone or watch)" value={value}
          onChange={(e) => setValue(e.target.value)} aria-label="Steps" />
        <button type="submit">{steps.steps ? 'Update' : 'Save'}</button>
      </form>
      {pct >= 100 && <p className="ok-text">🎉 Step goal reached!</p>}
    </div>
  );
}

// ---------- Cardio / strength list ----------
const emptyForm = { exercise_key: '', exercise: '', intensity: 'moderate', duration_min: '', sets: '', reps: '' };

function ExerciseList({ kind, date, info, items, onAdd, onToggle, onDelete, onCopy }) {
  const [form, setForm] = useState(emptyForm);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isCardio = kind === 'cardio';
  const catalog = info?.catalog[kind] ?? [];
  const isOther = form.exercise_key === 'other';

  // Live estimate, same formula as the server: MET x kg x hours
  const chosen = catalog.find((e) => e.key === form.exercise_key);
  const met = chosen ? chosen.met : isOther ? info?.intensities[form.intensity] : null;
  let minutes = Number(form.duration_min) || 0;
  if (!minutes && !isCardio && Number(form.sets) > 0) minutes = Number(form.sets) * (info?.minutes_per_set ?? 1.5);
  const estimate = met && minutes && info ? Math.round(met * info.weight_kg * (minutes / 60)) : null;

  const submit = async (e) => {
    e.preventDefault();
    const ok = await onAdd({
      date, kind,
      exercise_key: isOther ? null : form.exercise_key,
      exercise: isOther ? form.exercise : undefined,
      intensity: isOther ? form.intensity : undefined,
      duration_min: form.duration_min === '' ? null : Number(form.duration_min),
      sets: form.sets === '' ? null : Number(form.sets),
      reps: form.reps === '' ? null : Number(form.reps),
    });
    if (ok) setForm({ ...emptyForm });
  };

  const done = items.filter((w) => w.done).length;
  const kcalDone = items.filter((w) => w.done).reduce((s, w) => s + w.calories_burned, 0);

  return (
    <div className="card">
      <div className="card-head">
        <h2>{isCardio ? '🏃 Cardio' : '💪 Strength'}</h2>
        <span className="muted">{done}/{items.length} done · {kcalDone} kcal</span>
      </div>

      <form onSubmit={submit} className="ex-form">
        <select value={form.exercise_key} onChange={set('exercise_key')} required aria-label="Exercise">
          <option value="">Choose {isCardio ? 'cardio' : 'exercise'}…</option>
          {catalog.map((e) => <option key={e.key} value={e.key}>{e.name}</option>)}
          <option value="other">Other (type your own)…</option>
        </select>

        {isOther && (
          <div className="ex-row">
            <input placeholder="Exercise name" value={form.exercise} onChange={set('exercise')} required />
            <select value={form.intensity} onChange={set('intensity')} aria-label="Intensity">
              <option value="light">Light effort</option>
              <option value="moderate">Moderate effort</option>
              <option value="vigorous">Hard effort</option>
            </select>
          </div>
        )}

        {isCardio ? (
          <>
            <input type="number" min="1" max="600" placeholder="Minutes" value={form.duration_min} onChange={set('duration_min')} required />
            <div className="chips">
              {[15, 30, 45, 60].map((m) => (
                <button type="button" key={m} className={`chip ${Number(form.duration_min) === m ? 'active' : ''}`}
                  onClick={() => setForm({ ...form, duration_min: m })}>{m} min</button>
              ))}
            </div>
          </>
        ) : (
          <div className="ex-row three">
            <input type="number" min="1" max="50" placeholder="Sets" value={form.sets} onChange={set('sets')} />
            <input type="number" min="1" max="500" placeholder="Reps" value={form.reps} onChange={set('reps')} />
            <input type="number" min="1" max="600" placeholder="Minutes (auto)" value={form.duration_min} onChange={set('duration_min')} />
          </div>
        )}

        <div className="ex-estimate">
          {estimate != null ? (
            <>
              <strong>≈ {estimate} kcal</strong>
              <span className="muted tiny">
                {met} MET × {info.weight_kg} kg × {minutes} min ÷ 60
                {!isCardio && !form.duration_min && ` (${minutes} min from ${form.sets} sets)`}
              </span>
            </>
          ) : (
            <span className="muted tiny">Calories are calculated automatically.</span>
          )}
        </div>
        {info?.weight_is_default && (
          <p className="muted tiny">Using 70 kg. <a href="#goals">Log your weight in Goals</a> for a more accurate number.</p>
        )}
        <button type="submit" className="wide">Add {isCardio ? 'cardio' : 'exercise'}</button>
      </form>

      <ul className="list">
        {items.map((w) => (
          <li key={w.id} className={w.done ? 'done' : ''}>
            <label>
              <input type="checkbox" checked={!!w.done} onChange={() => onToggle(w.id)} />
              <span>{w.exercise}</span>
            </label>
            <span className="muted nowrap">
              {[w.sets && w.reps ? `${w.sets}×${w.reps}` : w.sets ? `${w.sets} sets` : null, `${w.duration_min} min`].filter(Boolean).join(' · ')}
            </span>
            <strong className="kcal-tag">{w.calories_burned} kcal</strong>
            <button className="del" onClick={() => onDelete(w.id)} aria-label="Delete">✕</button>
          </li>
        ))}
      </ul>

      {!items.length && (
        <p className="muted">
          Nothing planned yet. <button className="link" onClick={onCopy}>Copy previous day's {isCardio ? 'cardio' : 'exercises'}</button>
        </p>
      )}
      {items.length > 0 && <p className="muted tiny">Tick an exercise when you finish it. Only ticked ones count as burned.</p>}
    </div>
  );
}
