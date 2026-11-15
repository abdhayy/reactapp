import { useEffect, useState } from 'react';
import { api } from '../api';

const EXAMPLES = [
  'Nasi campur: nasi putih, kuah kari kambing, sayur campur',
  'Nasi separuh, ayam goreng 1 ketul, kangkung, teh o ais',
  'Roti canai 2 keping dengan kuah dal, teh tarik kurang manis',
];

// Shrink phone photos before upload (faster and cheaper)
function resizeImage(file, maxSize = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function AiEstimator({ onResult }) {
  const [configured, setConfigured] = useState(null);
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => { api.aiStatus().then((s) => setConfigured(s.configured)).catch(() => setConfigured(false)); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setImage(await resizeImage(file)); } catch (err) { setError(err.message); }
    e.target.value = '';
  };

  const estimate = async (e) => {
    e.preventDefault();
    if (!text.trim() && !image) return;
    setLoading(true); setError(''); setNotes('');
    try {
      const res = await api.aiEstimate(text, image);
      if (!res.items.length) {
        setError(res.notes || 'No food found.');
      } else {
        onResult(res.items.map((it) => ({ ...it, fromAi: true })));
        setNotes(res.notes);
        setText(''); setImage(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (configured === false) {
    return (
      <div className="setup">
        <p><strong>AI is not set up yet.</strong> To turn it on:</p>
        <ol>
          <li>Create an API key at <a href="https://platform.claude.com" target="_blank" rel="noreferrer">platform.claude.com</a> and add a few dollars of credit.</li>
          <li>In the <code>server</code> folder, copy <code>.env.example</code> to <code>.env</code>.</li>
          <li>Paste your key after <code>ANTHROPIC_API_KEY=</code>, save, and restart <code>npm run server</code>.</li>
        </ol>
        <p className="muted">You can still use the 🔎 Food list without AI.</p>
      </div>
    );
  }

  return (
    <form onSubmit={estimate} className="ai-form">
      <p className="muted">Describe what you ate in English or Malay, or add a photo. The AI splits it into items and estimates the calories.</p>
      <textarea
        rows={3} placeholder={EXAMPLES[0]} value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="chips">
        {EXAMPLES.map((ex) => (
          <button type="button" key={ex} className="chip" onClick={() => setText(ex)}>{ex.split(':')[0].split(',')[0]}</button>
        ))}
      </div>

      <div className="ai-actions">
        <label className="file-btn">
          📷 {image ? 'Change photo' : 'Add photo'}
          <input type="file" accept="image/*" capture="environment" onChange={onFile} hidden />
        </label>
        {image && (
          <span className="thumb">
            <img src={image} alt="Meal" />
            <button type="button" className="del" onClick={() => setImage(null)} aria-label="Remove photo">✕</button>
          </span>
        )}
        <button type="submit" disabled={loading || (!text.trim() && !image)}>
          {loading ? 'Estimating…' : '✨ Estimate calories'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {notes && <p className="note">💡 {notes}<br /><span className="muted tiny">Items were added to your plate. Adjust them before saving.</span></p>}
    </form>
  );
}
