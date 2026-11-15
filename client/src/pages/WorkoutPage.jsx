import WorkoutChecklist from '../components/WorkoutChecklist';

export default function WorkoutPage(props) {
  return (
    <div className="narrow">
      <WorkoutChecklist {...props} />
    </div>
  );
}
