import { useState } from 'react';
import { api } from '../api';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

// Guess the meal from the time of day
const defaultMealType = () => {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
};

const QTY_STEPS = [0.5, 1, 1.5, 2, 3];

export default function Plate({ date, plate, setPlate, onSave, onError }) {
  const [mealType, setMealType] = useState(defaultMealType);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (key, patch) => setPlate((p) => p.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const remove = (key) => setPlate((p) => p.filter((it) => it.key !== key));

  const sum = (field) => plate.reduce((s, it) => s + (it[field] || 0) * it.qty, 0);
  const total = Math.round(sum('calories'));

  const describe = (it) => (it.qty === 1 ? it.food_name : `${it.food_name} ×${it.qty}`);

  const save = async () => {
    if (!plate.length) return;
    setSaving(true);
    const items = plate.map(describe).join(', ');
    try {
      await onSave({
        date,
        meal_type: mealType,
        food_name: plate.length === 1 && !name.trim() ? items : `${name.trim() || 'Nasi campur'}: ${items}`,
        calories: total,
        protein_g: +sum('protein_g').toFixed(1),
        carbs_g: +sum('carbs_g').toFixed(1),
        fat_g: +sum('fat_g').toFixed(1),
      });
      setName('');
    } finally {
      setSaving(false);
    }
  };

  // Keep an AI estimate in the food list so next time you can just search it
  const remember = async (it) => {
    try {
      await api.saveFood({
        name: it.food_name, serving: it.portion || '1 hidangan', calories: it.calories,
        protein_g: it.protein_g, carbs_g: it.carbs_g, fat_g: it.fat_g, source: 'ai',
      });
      update(it.key, { saved: true });
    } catch (e) {
      onError(e.message);
    }
  };

  return (
    <div className="card plate">
      <div className="card-head">
        <h2>🍛 My plate</h2>
        <strong className="plate-total">{total} kcal</strong>
      </div>

      {!plate.length && (
        <p className="muted">Add items from the food list or AI. For nasi campur, add the rice, each lauk and the sayur, then save them together as one meal.</p>
      )}

      <ul className="list">
        {plate.map((it) => (
          <li key={it.key}>
            <div className="grow">
              <input className="plain" value={it.food_name} onChange={(e) => update(it.key, { food_name: e.target.value })} aria-label="Food name" />
              <div className="muted tiny">
                {it.portion} {it.fromAi && <span className="badge">AI</span>}
                {it.fromAi && !it.saved && <button className="link tiny" onClick={() => remember(it)}>☆ Save to my list</button>}
                {it.fromAi && it.saved && <span className="tiny"> ★ saved</span>}
              </div>
            </div>
            <select value={it.qty} onChange={(e) => update(it.key, { qty: Number(e.target.value) })} aria-label="Portion multiplier">
              {QTY_STEPS.map((q) => <option key={q} value={q}>×{q}</option>)}
            </select>
            <input
              className="kcal" type="number" min="0" value={it.calories}
              onChange={(e) => update(it.key, { calories: Number(e.target.value) })} aria-label="Calories per portion"
            />
            <button className="del" onClick={() => remove(it.key)} aria-label="Remove">✕</button>
          </li>
        ))}
      </ul>

      {plate.length > 0 && (
        <div className="plate-save">
          {plate.length > 1 && (
            <input placeholder="Meal name (default: Nasi campur)" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
            {MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button onClick={save} disabled={saving}>Save {total} kcal to {mealType}</button>
          <button className="secondary" onClick={() => setPlate([])}>Clear</button>
        </div>
      )}
    </div>
  );
}
