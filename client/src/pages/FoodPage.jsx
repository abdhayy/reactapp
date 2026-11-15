import { useState } from 'react';
import StatCards from '../components/StatCards';
import FoodSearch from '../components/FoodSearch';
import AiEstimator from '../components/AiEstimator';
import Plate from '../components/Plate';
import MealLog from '../components/MealLog';

let nextKey = 1;

// The "plate" collects one or more items (e.g. nasi + kari kambing + sayur campur)
// and saves them to the log as a single meal.
export default function FoodPage({ date, stats, meals, onAddMeal, onDeleteMeal, onGoal, onError }) {
  const [plate, setPlate] = useState([]);
  const [mode, setMode] = useState('search');

  const addToPlate = (items) =>
    setPlate((p) => [...p, ...items.map((it) => ({ qty: 1, ...it, key: nextKey++ }))]);

  return (
    <>
      <StatCards stats={stats} />
      <div className="grid">
        <div className="card">
          <div className="segmented">
            <button className={mode === 'search' ? 'active' : ''} onClick={() => setMode('search')}>🔎 Food list</button>
            <button className={mode === 'ai' ? 'active' : ''} onClick={() => setMode('ai')}>✨ Ask AI</button>
          </div>
          {mode === 'search'
            ? <FoodSearch onPick={(f) => addToPlate([f])} />
            : <AiEstimator onResult={addToPlate} />}
        </div>

        <div>
          <Plate
            date={date} plate={plate} setPlate={setPlate}
            onSave={async (meal) => { if (await onAddMeal(meal)) setPlate([]); }}
            onError={onError}
          />
          <MealLog meals={meals} goal={stats.goal} eaten={stats.eaten} onDelete={onDeleteMeal} onGoal={onGoal} />
        </div>
      </div>
    </>
  );
}
