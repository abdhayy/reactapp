import { useEffect, useState } from 'react';
import { api } from '../api';
import WeeklySummary from '../components/WeeklySummary';

const MEAL_TYPES = [
  { id: 'breakfast', icon: '🌅' },
  { id: 'lunch', icon: '☀️' },
  { id: 'dinner', icon: '🌙' },
  { id: 'snack', icon: '🍪' },
];

export default function Dashboard({ stats, meals, workouts, summary, onToggle, goTo }) {
  const [body, setBody] = useState(null);
  useEffect(() => { api.getBody().then(setBody).catch(() => {}); }, []);

  const { goal, eaten, burned, remaining } = stats;
  const pct = Math.min(100, Math.round((eaten / goal) * 100));
  const macros = meals.reduce(
    (t, m) => ({ p: t.p + m.protein_g, c: t.c + m.carbs_g, f: t.f + m.fat_g }),
    { p: 0, c: 0, f: 0 }
  );
  const done = workouts.filter((w) => w.done).length;

  return (
    <>
      {/* Hero: the day at a glance */}
      <section className="card hero">
        <Ring pct={pct} over={remaining < 0} value={Math.abs(remaining)} caption={remaining < 0 ? 'kcal over' : 'kcal left'} />
        <div className="hero-stats">
          <HeroStat icon="🎯" label="Goal" value={goal} />
          <HeroStat icon="🍽️" label="Eaten" value={eaten} />
          <HeroStat icon="🔥" label="Burned" value={burned} />
          <div className="macros">
            <Macro name="Protein" g={macros.p} kcalPerG={4} eaten={eaten} cls="p" />
            <Macro name="Carbs" g={macros.c} kcalPerG={4} eaten={eaten} cls="c" />
            <Macro name="Fat" g={macros.f} kcalPerG={9} eaten={eaten} cls="f" />
          </div>
        </div>
      </section>

      {body && <GoalStrip body={body} goTo={goTo} />}

      {/* Quick actions */}
      <section className="quick">
        <button onClick={() => goTo('food', { foodMode: 'search' })}><span>🔎</span>Log food</button>
        <button onClick={() => goTo('food', { foodMode: 'ai' })}><span>✨</span>Ask AI</button>
        <button onClick={() => goTo('workout')}><span>🏋️</span>Workout</button>
      </section>

      <div className="grid">
        <div className="card">
          <div className="card-head">
            <h2>Meals</h2>
            <button className="link" onClick={() => goTo('food')}>See all</button>
          </div>
          <ul className="meal-rows">
            {MEAL_TYPES.map(({ id, icon }) => {
              const items = meals.filter((m) => m.meal_type === id);
              const kcal = items.reduce((s, m) => s + m.calories, 0);
              return (
                <li key={id}>
                  <span className="meal-icon">{icon}</span>
                  <div className="grow">
                    <div className="cap">{id}</div>
                    <div className="muted tiny ellipsis-line">{items.map((m) => m.food_name).join(', ') || 'Nothing yet'}</div>
                  </div>
                  <strong className={kcal ? '' : 'muted'}>{kcal}</strong>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Workout</h2>
            <span className="muted">{done}/{workouts.length} done</span>
          </div>
          <div className="progress"><div className="green" style={{ width: workouts.length ? (done / workouts.length) * 100 + '%' : 0 }} /></div>
          <ul className="list compact">
            {workouts.map((w) => (
              <li key={w.id} className={w.done ? 'done' : ''}>
                <label>
                  <input type="checkbox" checked={!!w.done} onChange={() => onToggle(w.id)} />
                  <span>{w.exercise}</span>
                </label>
                {w.calories_burned > 0 && <span className="muted tiny">{w.calories_burned} kcal</span>}
              </li>
            ))}
          </ul>
          {!workouts.length && (
            <p className="muted">No workout planned. <button className="link" onClick={() => goTo('workout')}>Plan one</button></p>
          )}
        </div>
      </div>

      <WeeklySummary data={summary} goal={goal} />
    </>
  );
}

function Ring({ pct, over, value, caption }) {
  const r = 42, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="ring" role="img" aria-label={`${value} ${caption}`}>
      <circle cx="50" cy="50" r={r} className="ring-bg" />
      <circle cx="50" cy="50" r={r} className={over ? 'ring-fg over' : 'ring-fg'}
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} transform="rotate(-90 50 50)" />
      <text x="50" y="50" textAnchor="middle" className="ring-big">{value}</text>
      <text x="50" y="64" textAnchor="middle" className="ring-small">{caption}</text>
    </svg>
  );
}

function HeroStat({ icon, label, value }) {
  return (
    <div className="hero-stat">
      <span>{icon} {label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Macro({ name, g, kcalPerG, eaten, cls }) {
  const share = eaten ? Math.round(((g * kcalPerG) / eaten) * 100) : 0;
  return (
    <div className="macro">
      <span>{name}</span>
      <div className="progress thin"><div className={cls} style={{ width: Math.min(100, share) + '%' }} /></div>
      <span className="muted">{g.toFixed(0)}g</span>
    </div>
  );
}

function GoalStrip({ body, goTo }) {
  const { plan, month_target: t, current_weight: w } = body;
  if (!plan.ready || !t) {
    return (
      <button className="card goal-strip prompt" onClick={() => goTo('goals')}>
        <span className="goal-icon">🎯</span>
        <span className="grow">
          <strong>{plan.ready ? "Set this month's target weight" : 'Set up your weight goal'}</strong>
          <span className="muted tiny">{plan.ready ? 'Get a daily calorie plan to reach it' : 'Enter your height and weight to get a suggested daily intake'}</span>
        </span>
        <span className="chev">›</span>
      </button>
    );
  }
  return (
    <button className="card goal-strip" onClick={() => goTo('goals')}>
      <span className="goal-icon">⚖️</span>
      <span className="grow">
        <strong>{w} kg → {t.target_weight_kg} kg this month</strong>
        <span className="muted tiny">
          {plan.mode === 'reached' ? '🎉 Target reached' : `${plan.kg_to_go} kg to go`} · {plan.days_left} days left · suggested {plan.suggested} kcal/day
        </span>
      </span>
      <span className="chev">›</span>
    </button>
  );
}
