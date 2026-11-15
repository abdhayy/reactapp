import { useEffect, useState } from 'react';
import { api } from '../api';

const CATEGORIES = ['Nasi', 'Lauk', 'Sayur', 'Mee', 'Roti', 'Kuih', 'Minuman', 'Buah', 'Saya'];

export default function FoodSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [custom, setCustom] = useState({ name: '', calories: '' });

  // Search as you type (small delay so we don't query on every key)
  useEffect(() => {
    const t = setTimeout(() => {
      api.searchFoods(q).then(setResults).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (f) =>
    onPick({
      food_name: f.name, portion: f.serving, calories: f.calories,
      protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, saved: true,
    });

  const addCustom = (e) => {
    e.preventDefault();
    if (!custom.name.trim() || custom.calories === '') return;
    onPick({ food_name: custom.name.trim(), portion: '1 hidangan', calories: Number(custom.calories), protein_g: 0, carbs_g: 0, fat_g: 0 });
    setCustom({ name: '', calories: '' });
  };

  return (
    <>
      <input
        className="search" placeholder="Search e.g. nasi, kari, teh tarik…" value={q}
        onChange={(e) => setQ(e.target.value)} autoFocus
      />
      <div className="chips">
        {CATEGORIES.map((c) => (
          <button key={c} className={`chip ${q === c ? 'active' : ''}`} onClick={() => setQ(q === c ? '' : c)}>{c}</button>
        ))}
      </div>

      <ul className="list results">
        {results.map((f) => (
          <li key={f.id}>
            <div className="grow">
              <div>{f.name} {f.source !== 'builtin' && <span className="badge">{f.source === 'ai' ? 'AI' : 'mine'}</span>}</div>
              <div className="muted tiny">{f.serving}</div>
            </div>
            <span className="muted">{f.calories} kcal</span>
            <button className="add" onClick={() => pick(f)} aria-label={`Add ${f.name}`}>+</button>
          </li>
        ))}
        {!results.length && <li className="muted">Not in the list. Try ✨ Ask AI, or add it below.</li>}
      </ul>

      <form className="inline-form" onSubmit={addCustom}>
        <input placeholder="Other food" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
        <input type="number" min="0" placeholder="kcal" value={custom.calories} onChange={(e) => setCustom({ ...custom, calories: e.target.value })} />
        <button type="submit">Add</button>
      </form>
    </>
  );
}
