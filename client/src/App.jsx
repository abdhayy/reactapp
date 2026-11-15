import { useEffect, useState, useCallback } from 'react';
import { api, toDateStr, shiftDate } from './api';
import Dashboard from './pages/Dashboard';
import FoodPage from './pages/FoodPage';
import WorkoutPage from './pages/WorkoutPage';

const TABS = [
  { id: 'dashboard', label: '🏠 Dashboard' },
  { id: 'food', label: '🍽️ Food' },
  { id: 'workout', label: '🏋️ Workout' },
];

const tabFromHash = () => {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? h : 'dashboard';
};

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
  const [date, setDate] = useState(toDateStr(new Date()));
  const [goal, setGoal] = useState(2000);
  const [meals, setMeals] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [summary, setSummary] = useState([]);
  const [error, setError] = useState('');

  // Keep the tab in the URL (#food) so refresh and the back button work
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const goTo = (id) => { window.location.hash = id; setTab(id); };

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
    try { await fn(...args); await load(); return true; } catch (e) { setError(e.message); return false; }
  };

  // Tick the checkbox instantly, then save to the database
  const toggleWorkout = (id) => {
    setWorkouts((ws) => ws.map((w) => (w.id === id ? { ...w, done: w.done ? 0 : 1 } : w)));
    run(api.toggleWorkout)(id);
  };

  const eaten = meals.reduce((s, m) => s + m.calories, 0);
  const burned = workouts.filter((w) => w.done).reduce((s, w) => s + (w.calories_burned || 0), 0);
  const isToday = date === toDateStr(new Date());
  const stats = { goal, eaten, burned, remaining: goal - eaten + burned };

  return (
    <div className="app">
      <header>
        <h1>💪 Health Tracker</h1>
        <div className="date-nav">
          <button onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">◀</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day">▶</button>
          {!isToday && <button onClick={() => setDate(toDateStr(new Date()))}>Today</button>}
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => goTo(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {error && <div className="error" onClick={() => setError('')}>{error}</div>}

      {tab === 'dashboard' && (
        <Dashboard
          date={date} stats={stats} meals={meals} workouts={workouts} summary={summary}
          onToggle={toggleWorkout} goTo={goTo}
        />
      )}
      {tab === 'food' && (
        <FoodPage
          date={date} stats={stats} meals={meals}
          onAddMeal={run(api.addMeal)} onDeleteMeal={run(api.deleteMeal)} onGoal={run(api.setGoal)}
          onError={setError}
        />
      )}
      {tab === 'workout' && (
        <WorkoutPage
          date={date} workouts={workouts} burned={burned}
          onAdd={run(api.addWorkout)} onToggle={toggleWorkout} onDelete={run(api.deleteWorkout)}
          onCopyYesterday={run(() => api.copyWorkouts(shiftDate(date, -1), date))}
        />
      )}
    </div>
  );
}
