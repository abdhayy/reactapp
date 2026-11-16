import { useState } from 'react';
import { api } from '../api';

const GOAL_PRESETS = [
  { kcal: 1500, label: 'Lose weight' },
  { kcal: 2000, label: 'Maintain' },
  { kcal: 2500, label: 'Gain / active' },
];

export default function ProfilePage({ user, setUser, onLogout }) {
  const [name, setName] = useState(user.name);
  const [goal, setGoal] = useState(user.calorie_goal);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  const flash = (type, text) => setMsg({ type, text });

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      let u = user;
      if (name.trim() !== user.name) u = await api.updateMe({ name });
      if (Number(goal) !== user.calorie_goal) {
        await api.setGoal(Number(goal));
        u = { ...u, calorie_goal: Number(goal) };
      }
      setUser(u);
      flash('ok', 'Saved ✓');
    } catch (err) { flash('err', err.message); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await api.updateMe({ current_password: pw.current, new_password: pw.next });
      setPw({ current: '', next: '' });
      flash('ok', 'Password changed ✓');
    } catch (err) { flash('err', err.message); }
  };

  return (
    <div className="narrow">
      <div className="profile-head">
        <div className="avatar big">{user.name[0]?.toUpperCase()}</div>
        <div>
          <h1>{user.name}</h1>
          <div className="muted">@{user.username}</div>
        </div>
      </div>

      {msg.text && <p className={msg.type === 'ok' ? 'success' : 'error'} onClick={() => setMsg({})}>{msg.text}</p>}

      <form className="card" onSubmit={saveProfile}>
        <h2>Profile & goal</h2>
        <label className="field">Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">Daily calorie goal (kcal)
          <input type="number" min="500" max="10000" value={goal} onChange={(e) => setGoal(e.target.value)} required />
        </label>
        <div className="chips">
          {GOAL_PRESETS.map((p) => (
            <button type="button" key={p.kcal} className={`chip ${Number(goal) === p.kcal ? 'active' : ''}`} onClick={() => setGoal(p.kcal)}>
              {p.label} · {p.kcal}
            </button>
          ))}
        </div>
        <p className="muted tiny">These are rough guides. Your real needs depend on your age, weight, height and activity.</p>
        <button type="submit">Save</button>
      </form>

      <form className="card" onSubmit={changePassword}>
        <h2>Change password</h2>
        <label className="field">Current password
          <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required />
        </label>
        <label className="field">New password (min 6 characters)
          <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={6} required />
        </label>
        <button type="submit">Change password</button>
      </form>

      <button className="danger wide" onClick={onLogout}>Log out</button>
    </div>
  );
}
