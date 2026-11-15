import { useEffect, useState, useCallback } from 'react';
import { api, toDateStr, shiftDate } from './api';
import CalorieTracker from './components/CalorieTracker';
import WorkoutChecklist from './components/WorkoutChecklist';
import WeeklySummary from './components/WeeklySummary';

export default function App() {
  const [date, setDate] = useState(toDateStr(new Date()));
  const [goal, setGoal] = useState(2000);
  const [meals, setMeals] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [summary, setSummary] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, m, w, sum] = await Promise.all([
        api.getSettings(), api.getMeals(date), api.getWorkouts(date), api.getSummary(),
      ]);
      setGoal(s.calorie_goal);
      setMeals(m);
      setWorkouts(w);
      setSummary(sum);
      setError('');
    } catch (e) {
      setError('Cannot reach the server. Is it running on port 4000? (' + e.message + ')');
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // Wrap any API action so the screen refreshes afterwards
  const run = (fn) => async (...args) => {
    try { await fn(...args); await load(); } catch (e) { setError(e.message); }
  };

  // Tick the checkbox instantly, then save to the database
  const toggleWorkout = (id) => {
    setWorkouts((ws) => ws.map((w) => (w.id === id ? { ...w, done: w.done ? 0 : 1 } : w)));
    run(api.toggleWorkout)(id);
  };

  const eaten =meals.reduce((s, m) => s + m.calories, 0);
  const burned = workouts.filter((w) => w.done).reduce((s, w) => s + (w.calories_burned || 0), 0);
  const isToday = date === toDateStr(new Date());

  return (
    <div className="app">
      <header>
        <h1>💪 Health Tracker</h1>
        <div className="date-nav">
          <button onClick={() => setDate(shiftDate(date, -1))}>◀</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button onClick={() => setDate(shiftDate(date, 1))}>▶</button>
          {!isToday && <button onClick={() => setDate(toDateStr(new Date()))}>Today</button>}
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="stats">
        <Stat label="Goal" value={goal} />
        <Stat label="Eaten" value={eaten} />
        <Stat label="Burned" value={burned} />
        <Stat label="Remaining" value={goal - eaten + burned} highlight={goal - eaten + burned < 0 ? 'over' : 'ok'} />
      </section>

      <div className="grid">
        <CalorieTracker
          date={date} meals={meals} goal={goal} eaten={eaten}
          onAdd={run(api.addMeal)} onDelete={run(api.deleteMeal)} onGoal={run(api.setGoal)}
        />
        <WorkoutChecklist
          date={date} workouts={workouts}
          onAdd={run(api.addWorkout)} onToggle={toggleWorkout} onDelete={run(api.deleteWorkout)}
          onCopyYesterday={run(() => api.copyWorkouts(shiftDate(date, -1), date))}
        />
      </div>

      <WeeklySummary data={summary} goal={goal} />
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`stat ${highlight || ''}`}>
      <span>{label}</span>
      <strong>{value} kcal</strong>
    </div>
  );
}
