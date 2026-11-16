import { useState } from 'react';
import FoodSearch from '../components/FoodSearch';
import AiEstimator from '../components/AiEstimator';
import Plate from '../components/Plate';
import MealLog from '../components/MealLog';

let nextKey = 1;

// The "plate" collects one or more items (e.g. nasi + kari kambing + sayur campur)
// and saves them to the log as a single meal.
export default function FoodPage({ date, stats, meals, mode, setMode, onAddMeal, onDeleteMeal, onError }) {
  const [plate, setPlate] = useState([]);

  const addToPlate = (items) =>
    setPlate((p) => [...p, ...items.map((it) => ({ qty: 1, ...it, key: nextKey++ }))]);

  const pct = Math.min(100, Math.round((stats.eaten / stats.goal) * 100));

  return (
    <>
      <div className="summary-bar card">
        <div><strong>{stats.eaten}</strong> <span className="muted">/ {stats.goal} kcal eaten</span></div>
        <div className="progress"><div className={stats.eaten > stats.goal ? 'over' : ''} style={{ width: pct + '%' }} /></div>
        <div className={stats.remaining < 0 ? 'over-text' : 'ok-text'}>
          {stats.remaining < 0 ? `${-stats.remaining} over` : `${stats.remaining} left`}
        </div>
      </div>

      <div className="grid food-grid">
        <div className="card">
          <h2>Add food</h2>
          <div className="segmented">
            <button className={mode === 'search' ? 'active' : ''} onClick={() => setMode('search')}>🔎 Food list</button>
            <button className={mode === 'ai' ? 'active' : ''} onClick={() => setMode('ai')}>✨ Ask AI</button>
          </div>
          {mode === 'search'
            ? <FoodSearch onPick={(f) => addToPlate([f])} />
            : <AiEstimator onResult={addToPlate} />}
        </div>

        <div className="stack sticky">
          <Plate
            date={date} plate={plate} setPlate={setPlate}
            onSave={async (meal) => { if (await onAddMeal(meal)) setPlate([]); }}
            onError={onError}
          />
          <MealLog meals={meals} onDelete={onDeleteMeal} />
        </div>
      </div>
    </>
  );
}
