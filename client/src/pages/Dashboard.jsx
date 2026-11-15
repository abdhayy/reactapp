import StatCards from '../components/StatCards';
import WeeklySummary from '../components/WeeklySummary';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function Dashboard({ stats, meals, workouts, summary, onToggle, goTo }) {
  const { goal, eaten } = stats;
  const pct = Math.min(100, Math.round((eaten / goal) * 100));
  const macros = meals.reduce(
    (t, m) => ({ p: t.p + m.protein_g, c: t.c + m.carbs_g, f: t.f + m.fat_g }),
    { p: 0, c: 0, f: 0 }
  );
  const done = workouts.filter((w) => w.done).length;

  return (
    <>
      <StatCards stats={stats} />

      <div className="grid">
        <div className="card">
          <div className="card-head">
            <h2>🍽️ Today's food</h2>
            <button className="link" onClick={() => goTo('food')}>+ Add food</button>
          </div>
          <div className="ring-row">
            <Ring pct={pct} over={eaten > goal} label={`${pct}%`} />
            <div className="macros">
              <Macro name="Protein" g={macros.p} kcalPerG={4} eaten={eaten} />
              <Macro name="Carbs" g={macros.c} kcalPerG={4} eaten={eaten} />
              <Macro name="Fat" g={macros.f} kcalPerG={9} eaten={eaten} />
            </div>
          </div>
          <ul className="list compact">
            {MEAL_TYPES.map((type) => {
              const items = meals.filter((m) => m.meal_type === type);
              const kcal = items.reduce((s, m) => s + m.calories, 0);
              return (
                <li key={type}>
                  <span className="cap">{type}</span>
                  <span className="muted ellipsis">{items.map((m) => m.food_name).join(', ') || '—'}</span>
                  <strong>{kcal} kcal</strong>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>🏋️ Today's workout</h2>
            <button className="link" onClick={() => goTo('workout')}>Manage</button>
          </div>
          <div className="progress"><div className="green" style={{ width: workouts.length ? (done / workouts.length) * 100 + '%' : 0 }} /></div>
          <p className="muted">{done} of {workouts.length} exercises done · {stats.burned} kcal burned</p>
          <ul className="list compact">
            {workouts.map((w) => (
              <li key={w.id} className={w.done ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={!!w.done} onChange={() => onToggle(w.id)} />
                  <span>{w.exercise}</span>
                </label>
              </li>
            ))}
          </ul>
          {!workouts.length && <p className="muted">No workout planned for this day.</p>}
        </div>
      </div>

      <WeeklySummary data={summary} goal={goal} />
    </>
  );
}

function Ring({ pct, over, label }) {
  const r = 42, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="ring" role="img" aria-label={`${label} of daily goal`}>
      <circle cx="50" cy="50" r={r} className="ring-bg" />
      <circle cx="50" cy="50" r={r} className={over ? 'ring-fg over' : 'ring-fg'}
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} transform="rotate(-90 50 50)" />
      <text x="50" y="47" textAnchor="middle" className="ring-big">{label}</text>
      <text x="50" y="63" textAnchor="middle" className="ring-small">of goal</text>
    </svg>
  );
}

function Macro({ name, g, kcalPerG, eaten }) {
  const share = eaten ? Math.round(((g * kcalPerG) / eaten) * 100) : 0;
  return (
    <div className="macro">
      <span>{name}</span>
      <div className="progress thin"><div style={{ width: Math.min(100, share) + '%' }} /></div>
      <span className="muted">{g.toFixed(0)}g · {share}%</span>
    </div>
  );
}
