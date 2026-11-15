import { useState } from 'react';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function MealLog({ meals, goal, eaten, onDelete, onGoal }) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(goal);
  const pct = Math.min(100, Math.round((eaten / goal) * 100));

  return (
    <div className="card">
      <div className="card-head">
        <h2>📒 Food log</h2>
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
      <p className="muted">{eaten} / {goal} kcal</p>

      {MEAL_TYPES.map((type) => {
        const items = meals.filter((m) => m.meal_type === type);
        if (!items.length) return null;
        return (
          <div key={type}>
            <h3><span className="cap">{type}</span> <span className="muted">({items.reduce((s, m) => s + m.calories, 0)} kcal)</span></h3>
            <ul className="list">
              {items.map((m) => (
                <li key={m.id}>
                  <span className="grow">{m.food_name}</span>
                  <span className="muted nowrap">{m.calories} kcal</span>
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
