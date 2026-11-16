import { useState } from 'react';

// Weight over time: one line with dots, plus a dashed line for this month's target.
const W = 520, H = 220, PAD = { l: 36, r: 84, t: 14, b: 30 };

const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function WeightChart({ weights, target }) {
  const [hover, setHover] = useState(null);
  if (!weights.length) return <p className="muted">Log your weight to see your progress chart.</p>;

  const values = weights.map((w) => w.weight_kg).concat(target != null ? [target] : []);
  let min = Math.min(...values), max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.15);
  min = Math.floor(min - pad); max = Math.ceil(max + pad);

  const times = weights.map((w) => new Date(w.date + 'T00:00:00').getTime());
  const t0 = times[0], t1 = times[times.length - 1];
  const x = (t) => (t1 === t0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r));
  const y = (v) => PAD.t + ((max - v) / (max - min)) * (H - PAD.t - PAD.b);

  const pts = weights.map((w, i) => ({ ...w, cx: x(times[i]), cy: y(w.weight_kg) }));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ');
  const step = Math.max(1, Math.round((max - min) / 4));
  const ticks = [];
  for (let v = min; v <= max; v += step) ticks.push(v);

  // Find the nearest point to the pointer (hit area is the whole plot, not just the dot)
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.cx - px) < Math.abs(best.cx - px)) best = p;
    setHover(best);
  };

  return (
    <div className="wchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Weight chart: ${weights.length} entries, latest ${weights[weights.length - 1].weight_kg} kg`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid-line" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="axis-text">{v}</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} className="axis-text">{fmtDate(weights[0].date)}</text>
        {weights.length > 1 && (
          <text x={W - PAD.r} y={H - 6} textAnchor="end" className="axis-text">{fmtDate(weights[weights.length - 1].date)}</text>
        )}

        {target != null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} className="target-line" />
            <text x={W - PAD.r + 6} y={y(target) + 4} className="target-text">Target {target}</text>
          </g>
        )}

        <path d={path} className="weight-line" />
        {hover && <line x1={hover.cx} x2={hover.cx} y1={PAD.t} y2={H - PAD.b} className="crosshair" />}
        {pts.map((p) => (
          <circle key={p.id} cx={p.cx} cy={p.cy} r={hover?.id === p.id ? 6 : 4} className="weight-dot" />
        ))}
      </svg>
      {hover && (
        <div className="chart-tip" style={{ left: `${(hover.cx / W) * 100}%`, top: `${(hover.cy / H) * 100}%` }}>
          <strong>{hover.weight_kg} kg</strong>
          <span>{fmtDate(hover.date)}</span>
        </div>
      )}
    </div>
  );
}
