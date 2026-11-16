// Exercise list with MET values (how hard an activity is compared with resting).
// Values from the Compendium of Physical Activities.
// Calories burned = MET x body weight (kg) x hours.

const CATALOG = {
  cardio: [
    ['walking', 'Walking (normal pace)', 3.5],
    ['brisk_walking', 'Brisk walking', 4.3],
    ['jogging', 'Jogging', 7.0],
    ['running_8', 'Running (8 km/h)', 8.3],
    ['running_10', 'Running (10 km/h)', 9.8],
    ['running_12', 'Running (12 km/h)', 11.5],
    ['cycling_leisure', 'Cycling (leisure)', 4.0],
    ['cycling_moderate', 'Cycling (moderate, 19–22 km/h)', 8.0],
    ['stationary_bike', 'Stationary bike', 6.8],
    ['swimming', 'Swimming (moderate)', 6.0],
    ['jump_rope', 'Jump rope / skipping', 11.0],
    ['elliptical', 'Elliptical trainer', 5.0],
    ['stairs', 'Stair climbing', 8.8],
    ['hiking', 'Hiking', 6.0],
    ['rowing', 'Rowing machine', 7.0],
    ['aerobics', 'Aerobics / Zumba', 6.5],
    ['hiit', 'HIIT', 8.0],
    ['dancing', 'Dancing', 5.0],
    ['badminton', 'Badminton', 5.5],
    ['futsal', 'Futsal / football', 7.0],
    ['basketball', 'Basketball', 6.5],
    ['sepak_takraw', 'Sepak takraw', 6.0],
  ],
  strength: [
    ['push_ups', 'Push-ups', 3.8],
    ['sit_ups', 'Sit-ups / crunches', 3.8],
    ['plank', 'Plank', 3.8],
    ['squats', 'Squats', 5.0],
    ['lunges', 'Lunges', 4.0],
    ['pull_ups', 'Pull-ups', 8.0],
    ['burpees', 'Burpees', 8.0],
    ['dumbbells', 'Dumbbell / free weights', 3.5],
    ['machines', 'Gym machines', 3.5],
    ['heavy_lifting', 'Heavy lifting (deadlift, bench, squat)', 6.0],
    ['circuit', 'Circuit training', 8.0],
    ['yoga', 'Yoga', 2.5],
    ['stretching', 'Stretching', 2.3],
  ],
};

// For exercises not in the list
const INTENSITY = { light: 3.0, moderate: 5.0, vigorous: 8.0 };

const MINUTES_PER_SET = 1.5; // one set plus rest, used when minutes are not given
const DEFAULT_WEIGHT = 70;

const list = Object.fromEntries(
  Object.entries(CATALOG).map(([kind, rows]) => [kind, rows.map(([key, name, met]) => ({ key, name, met }))])
);
const byKey = Object.fromEntries(Object.values(list).flat().map((e) => [e.key, e]));

// Returns { name, met, minutes, calories } or throws a message
function calculate({ kind, exercise_key, exercise, intensity, sets, duration_min }, weightKg) {
  const known = exercise_key ? byKey[exercise_key] : null;
  if (exercise_key && !known) throw new Error('Unknown exercise');
  const name = known ? known.name : String(exercise || '').trim();
  if (!name) throw new Error('Choose or type an exercise');
  const met = known ? known.met : INTENSITY[intensity] ?? INTENSITY.moderate;

  let minutes = Number(duration_min) || 0;
  if (!minutes && kind === 'strength' && Number(sets) > 0) minutes = Number(sets) * MINUTES_PER_SET;
  if (!minutes) throw new Error(kind === 'cardio' ? 'Enter how many minutes' : 'Enter sets or minutes');
  if (minutes > 600) throw new Error('Minutes looks too long');

  const calories = Math.round(met * (weightKg || DEFAULT_WEIGHT) * (minutes / 60));
  return { name, met, minutes, calories };
}

// Steps: walking at ~100 steps per minute, MET 3.5
function stepCalories(steps, weightKg) {
  return Math.round(3.5 * (weightKg || DEFAULT_WEIGHT) * (steps / 100 / 60));
}

module.exports = { list, INTENSITY, MINUTES_PER_SET, DEFAULT_WEIGHT, calculate, stepCalories };
