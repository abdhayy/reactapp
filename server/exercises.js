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

// Jogging and running get extra fields: distance, pace and average heart rate
const RUN_KEYS = new Set(['jogging', 'running_8', 'running_10', 'running_12']);

const list = Object.fromEntries(
  Object.entries(CATALOG).map(([kind, rows]) =>
    [kind, rows.map(([key, name, met]) => ({ key, name, met, run: RUN_KEYS.has(key) }))])
);
const byKey = Object.fromEntries(Object.values(list).flat().map((e) => [e.key, e]));

const fail = (msg) => { throw Object.assign(new Error(msg), { status: 400 }); };

// "6:30" -> 390 seconds per km (also accepts a number of seconds)
function parsePace(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(String(v).trim());
  if (!m) fail('Pace must look like 6:30 (minutes:seconds per km)');
  return Number(m[1]) * 60 + Number(m[2]);
}
const fmtPace = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// Keytel et al. (2005): calories per minute from average heart rate, weight, age and sex
function heartRateKcalPerMin(hr, weight, age, sex) {
  const kj = sex === 'female'
    ? -20.4022 + 0.4472 * hr - 0.1263 * weight + 0.074 * age
    : -55.0969 + 0.6309 * hr + 0.1988 * weight + 0.2017 * age;
  return kj / 4.184;
}

// ACSM running equation: oxygen use from speed -> MET
const runningMet = (kmh) => (0.2 * ((kmh * 1000) / 60) + 3.5) / 3.5;

// input: { kind, exercise_key, exercise, intensity, sets, duration_min, distance_km, pace, avg_hr }
// person: { weight, age, sex } (age/sex may be null)
// Returns { name, met, minutes, calories, method, distance_km, pace_sec_per_km, avg_hr } or throws
function calculate(input, person = {}) {
  const { kind, exercise_key, exercise, intensity, sets } = input;
  const weight = person.weight || DEFAULT_WEIGHT;
  const known = exercise_key ? byKey[exercise_key] : null;
  if (exercise_key && !known) fail('Unknown exercise');
  const name = known ? known.name : String(exercise || '').trim();
  if (!name) fail('Choose or type an exercise');
  let met = known ? known.met : INTENSITY[intensity] ?? INTENSITY.moderate;
  let method = known ? `${name} effort (MET ${met})` : `${intensity || 'moderate'} effort (MET ${met})`;

  let minutes = Number(input.duration_min) || 0;
  let distance = null, pace = null, hr = null;

  if (known?.run) {
    distance = Number(input.distance_km) || null;
    pace = parsePace(input.pace);
    hr = Number(input.avg_hr) || null;
    if (distance != null && (distance <= 0 || distance > 200)) fail('Distance must be 0–200 km');
    if (pace != null && (pace < 150 || pace > 1200)) fail('Pace must be between 2:30 and 20:00 per km');
    if (hr != null && (hr < 40 || hr > 230)) fail('Heart rate must be 40–230 bpm');

    // Any two of time, distance and pace give the third
    if (!minutes && distance && pace) minutes = (distance * pace) / 60;
    if (minutes && distance && !pace) pace = (minutes * 60) / distance;
    if (minutes && pace && !distance) distance = (minutes * 60) / pace;

    if (pace) {
      const kmh = 3600 / pace;
      met = +runningMet(kmh).toFixed(1);
      method = `your speed ${kmh.toFixed(1)} km/h (MET ${met})`;
    }
  }

  if (!minutes && kind === 'strength' && Number(sets) > 0) minutes = Number(sets) * MINUTES_PER_SET;
  if (!minutes) fail(kind === 'cardio' ? (known?.run ? 'Enter minutes, or distance and pace' : 'Enter how many minutes') : 'Enter sets or minutes');
  if (minutes > 600) fail('Minutes looks too long');

  let calories = met * weight * (minutes / 60);

  // Heart rate gives a more personal number when we know age and sex
  if (hr && hr >= 90 && person.age && person.sex) {
    const perMin = heartRateKcalPerMin(hr, weight, person.age, person.sex);
    if (perMin > 0) {
      calories = perMin * minutes;
      method = `your heart rate ${hr} bpm, age ${person.age}, ${person.sex}`;
    }
  }

  return {
    name, met, method,
    minutes: Math.round(minutes * 10) / 10,
    calories: Math.round(calories),
    distance_km: distance != null ? Math.round(distance * 100) / 100 : null,
    pace_sec_per_km: pace != null ? Math.round(pace) : null,
    pace: pace != null ? fmtPace(pace) : null,
    avg_hr: hr,
    hr_ignored: Boolean(hr && !(hr >= 90 && person.age && person.sex)),
  };
}

// Steps: walking at ~100 steps per minute, MET 3.5
function stepCalories(steps, weightKg) {
  return Math.round(3.5 * (weightKg || DEFAULT_WEIGHT) * (steps / 100 / 60));
}

module.exports = { list, INTENSITY, MINUTES_PER_SET, DEFAULT_WEIGHT, calculate, stepCalories, fmtPace };
