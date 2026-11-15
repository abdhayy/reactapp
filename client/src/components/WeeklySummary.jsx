// Simple 7-day bar chart of calories eaten vs goal, plus workout completion.
export default function WeeklySummary({ data, goal }) {
  const max = Math.max(goal, ...data.map((d) => d.eaten)) || 1;
  const day = (s) => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });

  return (
    <div className="card">
      <h2>📊 Last 7 Days</h2>
      <div className="chart">
        <div className="goal-line" style={{ bottom: (goal / max) * 100 + '%' }} title={`Goal ${goal}`} />
        {data.map((d) => (
          <div key={d.date} className="bar-col" title={`${d.date}: ${d.eaten} kcal eaten, ${d.burned} burned`}>
            <span className="bar-val">{d.eaten || ''}</span>
            <div className={`bar ${d.eaten > goal ? 'over' : ''}`} style={{ height: (d.eaten / max) * 100 + '%' }} />
            <span className="bar-label">{day(d.date)}</span>
            <span className="muted tiny">{d.workouts_total ? `🏋️ ${d.workouts_done}/${d.workouts_total}` : '—'}</span>
          </div>
        ))}
      </div>
      <p className="muted tiny">Dashed line = daily goal. Red bar = over goal.</p>
    </div>
  );
}
