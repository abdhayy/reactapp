// Works out how many calories a user should eat per day.
//
// 1. BMR (calories burned at rest) with the Mifflin-St Jeor formula
// 2. TDEE (calories burned per day) = BMR x activity factor
// 3. To change weight: 1 kg of body fat ~ 7700 kcal. The kg still to lose (or gain)
//    this month is spread over the days left in the month.
// 4. Safety limits: no more than ~1 kg/week loss (1000 kcal/day deficit),
//    never below 1200 kcal (women) / 1500 kcal (men), and at most +500 kcal/day to gain.

const ACTIVITY = {
  sedentary: { factor: 1.2, label: 'Sedentary (little or no exercise)' },
  light: { factor: 1.375, label: 'Light (exercise 1–3 days/week)' },
  moderate: { factor: 1.55, label: 'Moderate (exercise 3–5 days/week)' },
  active: { factor: 1.725, label: 'Active (exercise 6–7 days/week)' },
  very_active: { factor: 1.9, label: 'Very active (hard exercise or physical job)' },
};

const KCAL_PER_KG = 7700;
const MAX_DEFICIT = 1000; // ~1 kg per week
const MAX_SURPLUS = 500; // ~0.5 kg per week
const MIN_KCAL = { male: 1500, female: 1200 };

// BMI categories used in Malaysia (Clinical Practice Guidelines, Asian cut-offs)
function bmiInfo(weight, heightCm) {
  const bmi = weight / (heightCm / 100) ** 2;
  const category =
    bmi < 18.5 ? 'Underweight' : bmi < 23 ? 'Normal' : bmi < 27.5 ? 'Overweight' : 'Obese';
  // Healthy weight range for this height (BMI 18.5–22.9)
  const h2 = (heightCm / 100) ** 2;
  return { bmi: +bmi.toFixed(1), category, healthy_min: +(18.5 * h2).toFixed(1), healthy_max: +(22.9 * h2).toFixed(1) };
}

const round10 = (n) => Math.round(n / 10) * 10;

// profile: { sex, birth_year, height_cm, activity, goal_weight_kg }
// weight: latest weight in kg. monthTarget: target weight for this month (or null).
// today: Date
function calculatePlan(profile, weight, monthTarget, today = new Date()) {
  const missing = [];
  if (!profile.sex) missing.push('sex');
  if (!profile.birth_year) missing.push('birth year');
  if (!profile.height_cm) missing.push('height');
  if (!profile.activity) missing.push('activity level');
  if (!weight) missing.push('current weight');
  if (missing.length) return { ready: false, missing };

  const age = today.getFullYear() - profile.birth_year;
  const bmr = 10 * weight + 6.25 * profile.height_cm - 5 * age + (profile.sex === 'male' ? 5 : -161);
  const tdee = bmr * (ACTIVITY[profile.activity]?.factor ?? 1.2);
  const minKcal = MIN_KCAL[profile.sex] ?? 1200;

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - today.getDate() + 1; // including today

  const plan = {
    ready: true,
    age,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    ...bmiInfo(weight, profile.height_cm),
    days_left: daysLeft,
    warnings: [],
  };

  if (monthTarget == null) {
    // No monthly target: eat to keep the current weight
    return { ...plan, mode: 'maintain', suggested: round10(tdee), kg_to_go: 0, daily_change: 0 };
  }

  const kgToGo = +(weight - monthTarget).toFixed(1); // positive = lose, negative = gain
  if (Math.abs(kgToGo) < 0.1) {
    return { ...plan, mode: 'reached', suggested: round10(tdee), kg_to_go: 0, daily_change: 0 };
  }

  const mode = kgToGo > 0 ? 'lose' : 'gain';
  const neededDaily = (Math.abs(kgToGo) * KCAL_PER_KG) / daysLeft; // kcal/day deficit or surplus
  let change = neededDaily;
  let suggested;

  if (mode === 'lose') {
    if (change > MAX_DEFICIT) {
      change = MAX_DEFICIT;
      plan.warnings.push(
        `Losing ${kgToGo} kg in ${daysLeft} days is faster than the safe rate of about 1 kg per week.`
      );
    }
    suggested = tdee - change;
    if (suggested < minKcal) {
      suggested = minKcal;
      change = tdee - minKcal;
      plan.warnings.push(`Eating below ${minKcal} kcal a day is not recommended without a doctor.`);
    }
  } else {
    if (change > MAX_SURPLUS) {
      change = MAX_SURPLUS;
      plan.warnings.push(
        `Gaining ${-kgToGo} kg in ${daysLeft} days is faster than the healthy rate of about 0.5 kg per week.`
      );
    }
    suggested = tdee + change;
  }

  // What you can realistically reach by month end at the suggested intake
  const reachableKg = (change * daysLeft) / KCAL_PER_KG;
  const expectedEnd = +(mode === 'lose' ? weight - reachableKg : weight + reachableKg).toFixed(1);

  return {
    ...plan,
    mode,
    kg_to_go: Math.abs(kgToGo),
    suggested: round10(suggested),
    daily_change: Math.round(change),
    needed_daily: Math.round(neededDaily),
    expected_end_weight: expectedEnd,
    reachable: plan.warnings.length === 0,
    weekly_rate: +((change * 7) / KCAL_PER_KG).toFixed(2),
  };
}

module.exports = { calculatePlan, ACTIVITY };
