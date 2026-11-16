import { useEffect, useState, useCallback } from 'react';
import { api, setUnauthorizedHandler, toDateStr, shiftDate } from './api';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import FoodPage from './pages/FoodPage';
import WorkoutPage from './pages/WorkoutPage';
import ProfilePage from './pages/ProfilePage';

const TABS = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'food', icon: '🍽️', label: 'Food' },
  { id: 'workout', icon: '🏋️', label: 'Workout' },
  { id: 'profile', icon: '👤', label: 'Profile' },
];

const tabFromHash = () => {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? h : 'home';
};

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = logged out

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="splash">💪</div>;
  if (!user) return <AuthPage onLogin={setUser} />;
  return <MainApp user={user} setUser={setUser} />;
}

function MainApp({ user, setUser }) {
  const [tab, setTab] = useState(tabFromHash);
  const [foodMode, setFoodMode] = useState('search');
  const [date, setDate] = useState(toDateStr(new Date()));
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
  const goTo = (id, opts = {}) => {
    if (opts.foodMode) setFoodMode(opts.foodMode);
    window.location.hash = id;
    setTab(id);
    window.scrollTo(0, 0);
  };

  const load = useCallback(async () => {
    try {
      const [m, w, sum] = await Promise.all([api.getMeals(date), api.getWorkouts(date), api.getSummary()]);
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

  const logout = async () => {
    await api.logout().catch(() => {});
    window.location.hash = '';
    setUser(null);
  };

  const goal = user.calorie_goal;
  const eaten = meals.reduce((s, m) => s + m.calories, 0);
  const burned = workouts.filter((w) => w.done).reduce((s, w) => s + (w.calories_burned || 0), 0);
  const stats = { goal, eaten, burned, remaining: goal - eaten + burned };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">💪 <span>Health Tracker</span></div>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => goTo(t.id)}>
              <span className="nav-icon">{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{user.name[0]?.toUpperCase()}</div>
          <div className="grow">
            <div className="ellipsis-line">{user.name}</div>
            <div className="muted tiny">@{user.username}</div>
          </div>
          <button className="link" onClick={logout}>Log out</button>
        </div>
      </aside>

      <main className="content">
        {tab !== 'profile' && (
          <TopBar user={user} date={date} setDate={setDate} />
        )}
        {error && <div className="error" onClick={() => setError('')}>{error}</div>}

        {tab === 'home' && (
          <Dashboard
            stats={stats} meals={meals} workouts={workouts} summary={summary}
            onToggle={toggleWorkout} goTo={goTo}
          />
        )}
        {tab === 'food' && (
          <FoodPage
            date={date} stats={stats} meals={meals} mode={foodMode} setMode={setFoodMode}
            onAddMeal={run(api.addMeal)} onDeleteMeal={run(api.deleteMeal)} onError={setError}
          />
        )}
        {tab === 'workout' && (
          <WorkoutPage
            date={date} workouts={workouts} burned={burned}
            onAdd={run(api.addWorkout)} onToggle={toggleWorkout} onDelete={run(api.deleteWorkout)}
            onCopyYesterday={run(() => api.copyWorkouts(shiftDate(date, -1), date))}
          />
        )}
        {tab === 'profile' && <ProfilePage user={user} setUser={setUser} onLogout={logout} />}
      </main>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => goTo(t.id)}>
            <span className="nav-icon">{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Selamat pagi' : h < 15 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam';
}

function TopBar({ user, date, setDate }) {
  const todayStr = toDateStr(new Date());
  const label =
    date === todayStr ? 'Today' :
    date === shiftDate(todayStr, -1) ? 'Yesterday' :
    new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="topbar">
      <div>
        <div className="muted">{greeting()},</div>
        <h1>{user.name.split(' ')[0]} 👋</h1>
      </div>
      <div className="date-pill">
        <button onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">‹</button>
        <label className="date-label">
          {label}
          <input type="date" value={date} max={todayStr} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <button onClick={() => setDate(shiftDate(date, 1))} disabled={date >= todayStr} aria-label="Next day">›</button>
      </div>
    </div>
  );
}
