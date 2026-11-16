import WorkoutChecklist from '../components/WorkoutChecklist';

export default function WorkoutPage(props) {
  const done = props.workouts.filter((w) => w.done).length;
  return (
    <div className="narrow">
      <div className="summary-bar card">
        <div><strong>{done}/{props.workouts.length}</strong> <span className="muted">exercises done</span></div>
        <div className="progress"><div className="green" style={{ width: props.workouts.length ? (done / props.workouts.length) * 100 + '%' : 0 }} /></div>
        <div className="ok-text">🔥 {props.burned} kcal</div>
      </div>
      <WorkoutChecklist {...props} />
    </div>
  );
}
