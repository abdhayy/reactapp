import { useEffect, useState } from 'react';
import { api, toDateStr } from '../api';
import WeightChart from '../components/WeightChart';

const monthName = (ym) => new Date(ym + '-01T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const monthEnd = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export default function GoalsPage({ onGoalChanged }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const call = async (fn, msg) => {
    try {
      const s = await fn();
      setState(s);
      setError('');
      if (msg) { setSaved(msg); setTimeout(() => setSaved(''), 2500); }
      return s;
    } catch (e) { setError(e.message); return null; }
  };

  useEffect(() => { call(api.getBody); }, []);
  if (!state) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  const { profile, plan, current_weight } = state;
  const profileDone = profile.sex && profile.birth_year && profile.height_cm && profile.activity;

  const apply = async () => {
    const s = await call(api.applySuggestion, `Daily goal set to ${state.plan.suggested} kcal ✓`);
    if (s) onGoalChanged(s.calorie_goal);
  };

  return (
    <div className="goals">
      {error && <p className="error" onClick={() => setError('')}>{error}</p>}
      {saved && <p className="success">{saved}</p>}

      {(!profileDone || !current_weight) && (
        <div className="card setup-card">
          <h2>👋 Let's set up your goal</h2>
          <p className="muted">Enter your body details and current weight. The app will work out how many calories you need each day.</p>
        </div>
      )}

      {(() => {
        const target = <MonthTargetCard state={state} onSave={(t) => call(() => api.setTarget(t), 'Monthly target saved ✓')}
          onRemove={() => call(api.removeTarget)} />;
        const weight = <WeightCard state={state}
          onLog={(w, d) => call(() => api.logWeight(w, d), 'Weight saved ✓')}
          onDelete={(id) => call(() => api.deleteWeight(id))} />;
        const body = <BodyCard state={state} onSave={(p) => call(() => api.saveBody(p), 'Profile saved ✓')} />;

        // New users: body profile and weight first (steps 1 and 2), then the target
        if (!plan.ready) {
          return (
            <div className="grid">
              <div className="stack">{body}</div>
              <div className="stack">{weight}{target}</div>
            </div>
          );
        }
        return (
          <div className="grid">
            <div className="stack">
              <SuggestionCard state={state} onApply={apply} />
              {target}
              <HistoryCard history={state.history} />
            </div>
            <div className="stack">{weight}{body}</div>
          </div>
        );
      })()}
    </div>
  );
}

// ---------- Calorie suggestion ----------
function SuggestionCard({ state, onApply }) {
  const { plan, month_target, current_weight, calorie_goal, month } = state;
  const isGoal = plan.suggested === calorie_goal;

  let headline;
  if (plan.mode === 'maintain') headline = <>To <strong>keep your weight</strong> at {current_weight} kg</>;
  else if (plan.mode === 'reached') headline = <>🎉 You reached this month's target. To <strong>stay</strong> at {current_weight} kg</>;
  else headline = <>To {plan.mode === 'lose' ? 'lose' : 'gain'} <strong>{plan.kg_to_go} kg</strong> and reach <strong>{month_target.target_weight_kg} kg</strong> by {monthEnd(month)}</>;

  return (
    <div className="card suggest">
      <div className="muted">{headline}, eat about</div>
      <div className="suggest-kcal">{plan.suggested.toLocaleString()} <span>kcal / day</span></div>

      {(plan.mode === 'lose' || plan.mode === 'gain') && (
        <p className="muted">
          That's {plan.daily_change} kcal {plan.mode === 'lose' ? 'less' : 'more'} than you burn each day ({plan.tdee} kcal),
          about {plan.weekly_rate} kg per week, over the {plan.days_left} days left this month.
        </p>
      )}

      {plan.warnings.length > 0 && (
        <div className="warn">
          <strong>⚠️ This target is too fast to reach safely.</strong>
          <ul>{plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          <span>At {plan.suggested} kcal a day you can expect about <strong>{plan.expected_end_weight} kg</strong> by month end. Consider a smaller monthly target.</span>
        </div>
      )}

      <div className="suggest-figures">
        <div><span>BMR</span><strong>{plan.bmr}</strong><em>burned at rest</em></div>
        <div><span>TDEE</span><strong>{plan.tdee}</strong><em>burned per day</em></div>
        <div><span>Current goal</span><strong>{calorie_goal}</strong><em>kcal / day</em></div>
      </div>

      {isGoal
        ? <p className="ok-text">✓ This is your daily calorie goal</p>
        : <button className="wide" onClick={onApply}>Use {plan.suggested} kcal as my daily goal</button>}
    </div>
  );
}

// ---------- This month's target ----------
function MonthTargetCard({ state, onSave, onRemove }) {
  const { month, month_target, current_weight, profile, plan } = state;
  const [value, setValue] = useState(month_target?.target_weight_kg ?? '');
  const [editing, setEditing] = useState(!month_target);

  useEffect(() => {
    setValue(month_target?.target_weight_kg ?? '');
    setEditing(!month_target);
  }, [month_target]);

  if (!current_weight) {
    return (
      <div className="card">
        <h2>🎯 Target for {monthName(month)}</h2>
        <p className="muted">Log your current weight first, then set the weight you want to reach by the end of this month.</p>
      </div>
    );
  }

  // Quick choices in the direction of the long-term goal (default: lose)
  const losing = profile.goal_weight_kg == null || profile.goal_weight_kg < current_weight;
  const presets = (losing ? [-0.5, -1, -2, -3] : [0.5, 1, 1.5, 2]).map((d) => +(current_weight + d).toFixed(1));

  const t = month_target;
  let pct = 0;
  if (t && t.start_weight_kg != null && t.start_weight_kg !== t.target_weight_kg) {
    pct = ((t.start_weight_kg - current_weight) / (t.start_weight_kg - t.target_weight_kg)) * 100;
  }
  pct = Math.max(0, Math.min(100, pct));

  return (
    <div className="card">
      <div className="card-head">
        <h2>🎯 Target for {monthName(month)}</h2>
        {t && !editing && <button className="link" onClick={() => setEditing(true)}>Change</button>}
      </div>

      {t && !editing ? (
        <>
          <div className="target-row">
            <div><span className="muted">Start</span><strong>{t.start_weight_kg ?? '—'} kg</strong></div>
            <div><span className="muted">Now</span><strong>{current_weight} kg</strong></div>
            <div><span className="muted">Target</span><strong className="accent">{t.target_weight_kg} kg</strong></div>
          </div>
          <div className="progress"><div className="green" style={{ width: pct + '%' }} /></div>
          <p className="muted">
            {plan.mode === 'reached' ? '🎉 Target reached!' : `${plan.kg_to_go ?? '—'} kg to go`} · {plan.days_left ?? '—'} days left this month
          </p>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); onSave(Number(value)); }}>
          <p className="muted">What weight do you want to reach by {monthEnd(month)}? You are {current_weight} kg now.</p>
          <div className="chips">
            {presets.map((p) => (
              <button type="button" key={p} className={`chip ${Number(value) === p ? 'active' : ''}`} onClick={() => setValue(p)}>
                {p} kg ({p < current_weight ? '' : '+'}{(p - current_weight).toFixed(1)})
              </button>
            ))}
          </div>
          <div className="inline-form">
            <input type="number" step="0.1" min="20" max="400" placeholder="Target kg" value={value} onChange={(e) => setValue(e.target.value)} required />
            <button type="submit">Save target</button>
            {t && <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>}
          </div>
          <p className="muted tiny">A safe pace is about 0.5–1 kg per week (2–4 kg per month).</p>
          {t && <button type="button" className="link tiny" onClick={onRemove}>Remove this month's target</button>}
        </form>
      )}
    </div>
  );
}

// ---------- Weight log ----------
function WeightCard({ state, onLog, onDelete }) {
  const today = toDateStr(new Date());
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(today);
  const recent = [...state.weights].reverse().slice(0, 5);

  return (
    <div className="card">
      <h2>⚖️ Weight</h2>
      <form className="inline-form" onSubmit={async (e) => { e.preventDefault(); await onLog(Number(weight), date); setWeight(''); }}>
        <input type="number" step="0.1" min="20" max="400" placeholder={state.current_weight ? `${state.current_weight} kg` : 'Weight (kg)'}
          value={weight} onChange={(e) => setWeight(e.target.value)} required aria-label="Weight in kg" />
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
        <button type="submit">Log</button>
      </form>

      <WeightChart weights={state.weights} target={state.month_target?.target_weight_kg ?? null} />

      {recent.length > 0 && (
        <ul className="list compact">
          {recent.map((w) => (
            <li key={w.id}>
              <span className="grow">{new Date(w.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <strong>{w.weight_kg} kg</strong>
              <button className="del" onClick={() => onDelete(w.id)} aria-label="Delete">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Body profile ----------
function BodyCard({ state, onSave }) {
  const { profile, plan, activity_levels } = state;
  const empty = { sex: '', birth_year: '', height_cm: '', activity: '', goal_weight_kg: '' };
  const toForm = (p) => Object.fromEntries(Object.keys(empty).map((k) => [k, p[k] ?? '']));
  const [form, setForm] = useState(toForm(profile));
  const done = profile.sex && profile.birth_year && profile.height_cm && profile.activity;
  const [editing, setEditing] = useState(!done);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const s = await onSave(form);
    if (s) setEditing(false);
  };

  if (!editing) {
    return (
      <div className="card">
        <div className="card-head">
          <h2>🧍 Body profile</h2>
          <button className="link" onClick={() => { setForm(toForm(profile)); setEditing(true); }}>Edit</button>
        </div>
        <div className="body-grid">
          <div><span className="muted">Sex</span><strong className="cap">{profile.sex}</strong></div>
          <div><span className="muted">Age</span><strong>{plan.age ?? new Date().getFullYear() - profile.birth_year}</strong></div>
          <div><span className="muted">Height</span><strong>{profile.height_cm} cm</strong></div>
          <div><span className="muted">Goal weight</span><strong>{profile.goal_weight_kg ? `${profile.goal_weight_kg} kg` : '—'}</strong></div>
          {plan.ready && (
            <div className="span2">
              <span className="muted">BMI</span>
              <strong>{plan.bmi} <span className={`bmi ${plan.category.toLowerCase()}`}>{plan.category}</span></strong>
              <span className="muted tiny">Healthy weight for your height: {plan.healthy_min}–{plan.healthy_max} kg</span>
            </div>
          )}
        </div>
        <p className="muted tiny">{activity_levels.find((a) => a.id === profile.activity)?.label}</p>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>🧍 Body profile</h2>
      <div className="field-grid">
        <label className="field">Sex
          <select value={form.sex} onChange={set('sex')} required>
            <option value="">Choose…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label className="field">Birth year
          <input type="number" min="1920" max={new Date().getFullYear() - 13} placeholder="e.g. 2004" value={form.birth_year} onChange={set('birth_year')} required />
        </label>
        <label className="field">Height (cm)
          <input type="number" step="0.5" min="100" max="250" placeholder="e.g. 170" value={form.height_cm} onChange={set('height_cm')} required />
        </label>
        <label className="field">Goal weight (kg) <span className="muted tiny">optional</span>
          <input type="number" step="0.1" min="30" max="300" placeholder="e.g. 65" value={form.goal_weight_kg} onChange={set('goal_weight_kg')} />
        </label>
      </div>
      <label className="field">Activity level
        <select value={form.activity} onChange={set('activity')} required>
          <option value="">Choose…</option>
          {activity_levels.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>
      <button type="submit" className="wide">Save profile</button>
    </form>
  );
}

// ---------- Past months ----------
function HistoryCard({ history }) {
  if (!history.length) return null;
  return (
    <div className="card">
      <h2>📅 Past months</h2>
      <ul className="list compact">
        {history.map((h) => (
          <li key={h.month}>
            <span className="grow">{monthName(h.month)}</span>
            <span className="muted">target {h.target_weight_kg} · ended {h.end_weight_kg ?? '—'} kg</span>
            <span>{h.achieved == null ? '—' : h.achieved ? '✅' : '❌'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
