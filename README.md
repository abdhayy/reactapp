# Health Tracker

Track your daily **calorie intake** and tick off your **workout checklist**.

- **Login:** each person has their own account, data and calorie goal
- **Home:** today's calories left, macros, meals, workout checklist, quick actions and a 7-day chart
- **Food:** search ~90 common Malaysian foods, or describe your meal (or snap a photo) and let AI estimate it.
  Build a "plate" (e.g. nasi + kari kambing + sayur campur) and save it as one meal.
- **Exercise:** separate **Cardio** and **Strength** lists, calories burned calculated automatically,
  and a daily **steps** counter with a step goal
- **Goals:** enter your sex, birth year, height and activity level, log your weight, and set a
  **target weight for each month**. The app suggests how many calories to eat per day to reach it.
- **Profile:** change your name, calorie goal and password

On a computer the menu is on the left; on a phone it is a bottom tab bar.

- **Frontend:** React (Vite), in `client/`
- **Backend:** Node.js + Express, in `server/`
- **Database:** SQLite, saved in one file: `server/health.db` (created automatically on first run)

## Run it

Requires Node.js 18 or newer.

```bash
npm run install:all
```

Terminal 1 (API on http://localhost:4000):
```bash
npm run server
```

Terminal 2 (app on http://localhost:5173):
```bash
npm run client
```

## How the calorie suggestion works

`server/plan.js` does the maths:

1. **BMR** (calories burned at rest), Mifflin-St Jeor formula:
   `10 × weight + 6.25 × height − 5 × age + 5` (men) or `− 161` (women)
2. **TDEE** (calories burned per day) = BMR × activity factor (1.2 sedentary … 1.9 very active)
3. **Monthly target**: 1 kg of body fat ≈ 7700 kcal. The kg left to lose this month × 7700,
   divided by the days left in the month, is the daily deficit. Suggested intake = TDEE − deficit.
4. **Safety limits**: at most ~1 kg/week loss (1000 kcal/day deficit), never below 1200 kcal (women) /
   1500 kcal (men), at most +500 kcal/day to gain. If the target is too fast, the app warns you and
   shows the weight you can realistically reach by month end.
5. **BMI** uses the Malaysian (Asian) cut-offs: normal 18.5–22.9, overweight 23–27.4, obese ≥ 27.5.

These are estimates for general guidance, not medical advice.

## How calories burned are calculated

`server/exercises.js` has a list of exercises with MET values (how hard an activity is
compared with resting, from the Compendium of Physical Activities).

- **Calories = MET × your weight (kg) × hours.** Your latest weight from Goals is used (70 kg if none).
- **Strength:** if you don't enter minutes, each set counts as 1.5 minutes (including rest).
- **Other exercises:** choose light / moderate / hard effort (MET 3 / 5 / 8).
- **Jogging / running:** enter any two of time, distance and pace (the third is worked out), plus
  optional average heart rate.
  - With pace: MET from your actual speed (ACSM running equation: VO2 = 0.2 × metres/min + 3.5).
  - With heart rate, and your sex and birth year saved in Goals: Keytel et al. (2005) heart-rate formula,
    which is more personal.
- **Steps:** walking at about 100 steps a minute (MET 3.5). 10,000 steps ≈ 400 kcal at 70 kg.
- Only exercises you **tick as done** count towards calories burned.

## Turn on AI calorie estimates (optional, free)

The AI uses **Google Gemini's free tier** (no credit card needed).

1. Go to https://aistudio.google.com/apikey, sign in with a Google account and click **Create API key**.
2. Copy `server/.env.example` to `server/.env` (Windows PowerShell: `copy server\.env.example server\.env`).
3. Open `server/.env` and paste your key after `GEMINI_API_KEY=`.
4. Restart `npm run server`.

Notes:
- The free tier has per-minute and per-day limits. If you hit them, the app tells you to wait.
- On the free tier, Google may use what you send to improve its products. Don't send anything private.
- If you see "model not found", set `GEMINI_MODEL` in `server/.env` to a current model from
  https://ai.google.dev/gemini-api/docs/models.
- `server/.env` is in `.gitignore`, so your key is never uploaded to GitHub.
- Prefer Claude (paid, pay-as-you-go)? Set `ANTHROPIC_API_KEY` instead; see `server/.env.example`.

## Database tables

| Table      | What it stores |
|------------|----------------|
| `users`    | username, name, password hash (scrypt, never the real password), calorie_goal, sex, birth_year, height_cm, activity, goal_weight_kg |
| `sessions` | Login sessions (hashed token from the browser cookie, expiry) |
| `weights`  | user_id, date, weight_kg (one per day) |
| `monthly_targets` | user_id, month (YYYY-MM), target_weight_kg, start_weight_kg |
| `meals`    | user_id, date, meal_type (breakfast/lunch/dinner/snack), food_name, calories, protein_g, carbs_g, fat_g |
| `workouts` | user_id, date, kind (cardio/strength), exercise, met, sets, reps, duration_min, distance_km, pace_sec_per_km, avg_hr, calc_method, calories_burned, done (0/1) |
| `daily_steps` | user_id, date, steps, calories |
| `foods`    | Food list: built-in foods (user_id 0) + each user's saved foods; name, serving, calories, macros |

The built-in Malaysian foods are in `server/foods-seed.js` and are added automatically.
Calorie values are typical-portion estimates; edit that file to adjust them or add more.

Upgrading from the version without login? Your existing data is kept and moves to the
**first account you sign up with**.

The schema is in `server/db.js`. To look at the data, open `server/health.db`
with [DB Browser for SQLite](https://sqlitebrowser.org/).

## API

All endpoints except `/api/auth/register` and `/api/auth/login` need you to be logged in.

| Method | URL | Purpose |
|--------|-----|---------|
| POST | `/api/auth/register` | Create account `{name, username, password}` |
| POST | `/api/auth/login` | Log in `{username, password}` |
| POST | `/api/auth/logout` | Log out |
| GET/PUT | `/api/auth/me` | Who am I / change name or password |
| GET/PUT | `/api/settings` | Read / change calorie goal |
| GET | `/api/meals?date=YYYY-MM-DD` | Meals for a day |
| POST | `/api/meals` | Add a meal |
| DELETE | `/api/meals/:id` | Remove a meal |
| GET | `/api/workouts?date=YYYY-MM-DD` | Workouts for a day |
| POST | `/api/workouts` | Add an exercise |
| PATCH | `/api/workouts/:id/toggle` | Tick / untick |
| DELETE | `/api/workouts/:id` | Remove an exercise |
| POST | `/api/workouts/copy` | Copy one day's list to another (`{from, to}`) |
| GET | `/api/body` | Body profile, weights, this month's target and the calorie suggestion |
| PUT | `/api/body/profile` | `{sex, birth_year, height_cm, activity, goal_weight_kg}` |
| POST | `/api/body/weights` | Log weight `{weight_kg, date}` |
| PUT/DELETE | `/api/body/target` | Set / remove this month's target `{target_weight_kg}` |
| POST | `/api/body/apply-suggestion` | Use the suggested intake as your daily calorie goal |
| GET | `/api/exercises` | Exercise list with MET values and your weight |
| POST | `/api/exercises/estimate` | Preview calories for an exercise without saving |
| GET/PUT | `/api/steps` | Steps for a day / save `{date, steps}` |
| PUT | `/api/steps/goal` | Change step goal `{step_goal}` |
| GET | `/api/summary` | Last 7 days: eaten, burned, workouts done |
| GET | `/api/foods?q=nasi` | Search the food list |
| POST | `/api/foods` | Save a food to your own list |
| GET | `/api/ai/status` | Is the AI key set up? |
| POST | `/api/ai/estimate` | `{text, image}` → estimated items with calories |
