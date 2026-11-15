export default function StatCards({ stats }) {
  const { goal, eaten, burned, remaining } = stats;
  return (
    <section className="stats">
      <Stat label="Goal" value={goal} />
      <Stat label="Eaten" value={eaten} />
      <Stat label="Burned" value={burned} />
      <Stat label="Remaining" value={remaining} highlight={remaining < 0 ? 'over' : 'ok'} />
    </section>
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
