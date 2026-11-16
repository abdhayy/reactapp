import { useState } from 'react';
import { api } from '../api';

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'register' && form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    try {
      const user = mode === 'login'
        ? await api.login(form.username, form.password)
        : await api.register({ name: form.name, username: form.username, password: form.password });
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m) => { setMode(m); setError(''); };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-logo">💪</div>
        <h1>Health Tracker</h1>
        <p className="muted">Track your calories and workouts every day.</p>

        <div className="segmented">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Log in</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Sign up</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label>Your name
              <input value={form.name} onChange={set('name')} autoComplete="name" required />
            </label>
          )}
          <label>Username
            <input value={form.username} onChange={set('username')} autoComplete="username" autoCapitalize="none" required />
          </label>
          <label>Password
            <input type="password" value={form.password} onChange={set('password')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 6 : undefined} />
          </label>
          {mode === 'register' && (
            <label>Confirm password
              <input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary-lg" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="muted tiny">
          {mode === 'login'
            ? <>No account yet? <button className="link" onClick={() => switchMode('register')}>Sign up</button></>
            : <>Already have an account? <button className="link" onClick={() => switchMode('login')}>Log in</button></>}
        </p>
      </div>
    </div>
  );
}
