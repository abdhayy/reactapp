const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export default function MealLog({ meals, onDelete }) {
  return (
    <div className="card">
      <h2>📒 Food log</h2>
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
