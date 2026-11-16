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
const emptyForm = {
  exercise_key: '', exercise: '', intensity: 'moderate', duration_min: '', sets: '', reps: '',
  distance_km: '', pace: '', avg_hr: '',
};

const fmtPace = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function buildPayload(form, kind, date) {
  const isOther = form.exercise_key === 'other';
  const n = (v) => (v === '' ? null : Number(v));
  return {
    date, kind,
    exercise_key: isOther ? null : form.exercise_key,
    exercise: isOther ? form.exercise : undefined,
    intensity: isOther ? form.intensity : undefined,
    duration_min: n(form.duration_min),
    sets: n(form.sets),
    reps: n(form.reps),
    distance_km: n(form.distance_km),
    pace: form.pace.trim() || null,
    avg_hr: n(form.avg_hr),
  };
}

function ExerciseList({ kind, date, info, items, onAdd, onToggle, onDelete, onCopy }) {
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState(null); // { calories, method, ... } or { error }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isCardio = kind === 'cardio';
  const catalog = info?.catalog[kind] ?? [];
  const isOther = form.exercise_key === 'other';
  const isRun = catalog.find((e) => e.key === form.exercise_key)?.run;

  // Ask the server for the estimate (same calculation as saving), shortly after typing stops
  useEffect(() => {
    if (!form.exercise_key || (isOther && !form.exercise.trim())) { setPreview(null); return; }
    const t = setTimeout(() => {
      api.estimateExercise(buildPayload(form, kind, date))
        .then(setPreview)
        .catch((e) => setPreview({ error: e.message }));
    }, 300);
    return () => clearTimeout(t);
  }, [form, kind, date, isOther]);

  const submit = async (e) => {
    e.preventDefault();
    const ok = await onAdd(buildPayload(form, kind, date));
    if (ok) { setForm({ ...emptyForm }); setPreview(null); }
  };

  const done = items.filter((w) => w.done).length;
  const kcalDone = items.filter((w) => w.done).reduce((s, w) => s + w.calories_burned, 0);

  // Show what the server worked out for the field the user left empty
  const derived = preview && !preview.error ? preview : null;

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

        {isRun ? (
          <div className="run-box">
            <div className="run-title">🏃 Run details <span className="muted tiny">fill any two of time, distance and pace</span></div>
            <div className="run-grid">
              <label>Distance (km)
                <input type="number" step="0.01" min="0.1" max="200" placeholder={derived?.distance_km && !form.distance_km ? `${derived.distance_km}` : 'e.g. 5'}
                  value={form.distance_km} onChange={set('distance_km')} />
              </label>
              <label>Pace (min/km)
                <input inputMode="numeric" pattern="\d{1,2}:[0-5]\d" title="minutes:seconds, e.g. 6:30"
                  placeholder={derived?.pace && !form.pace ? derived.pace : 'e.g. 6:30'} value={form.pace} onChange={set('pace')} />
              </label>
              <label>Time (min)
                <input type="number" step="0.1" min="1" max="600" placeholder={derived?.minutes && !form.duration_min ? `${derived.minutes}` : 'e.g. 30'}
                  value={form.duration_min} onChange={set('duration_min')} />
              </label>
              <label>Avg heart rate (bpm) <span className="muted tiny">optional</span>
                <input type="number" min="40" max="230" placeholder="e.g. 150" value={form.avg_hr} onChange={set('avg_hr')} />
              </label>
            </div>
            {derived?.hr_ignored && (
              <p className="muted tiny">Add your sex and birth year in <a href="#goals">Goals</a> to use heart rate for calories.</p>
            )}
          </div>
        ) : isCardio ? (
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
          {derived ? (
            <>
              <strong>≈ {derived.calories} kcal</strong>
              <span className="muted tiny">
                {isRun && derived.distance_km ? `${derived.distance_km} km · ${derived.pace} /km · ` : ''}
                {derived.minutes} min · based on {derived.method}
              </span>
            </>
          ) : preview?.error && (form.duration_min || form.distance_km || form.pace || form.sets) ? (
            <span className="field-error">{preview.error}</span>
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
              <span className="ex-name">
                {w.exercise}
                {w.distance_km != null && (
                  <span className="run-stats">
                    📏 {w.distance_km} km · ⏱️ {fmtPace(w.pace_sec_per_km)} /km{w.avg_hr ? ` · ❤️ ${w.avg_hr} bpm` : ''}
                  </span>
                )}
              </span>
            </label>
            <span className="muted nowrap">
              {[w.sets && w.reps ? `${w.sets}×${w.reps}` : w.sets ? `${w.sets} sets` : null, `${w.duration_min} min`].filter(Boolean).join(' · ')}
            </span>
            <strong className="kcal-tag" title={w.calc_method ? `Based on ${w.calc_method}` : undefined}>{w.calories_burned} kcal</strong>
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
