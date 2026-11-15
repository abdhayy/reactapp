# Health Tracker

Track your daily **calorie intake** and tick off your **workout checklist**.

- **Dashboard tab:** today's calories, macros, meals, workout progress and a 7-day chart
- **Food tab:** search ~90 common Malaysian foods, or describe your meal (or snap a photo) and let AI estimate it.
  Build a "plate" (e.g. nasi + kari kambing + sayur campur) and save it as one meal.
- **Workout tab:** plan exercises and tick them off

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
| `settings` | Your daily calorie goal |
| `meals`    | date, meal_type (breakfast/lunch/dinner/snack), food_name, calories, protein_g, carbs_g, fat_g |
| `workouts` | date, exercise, sets, reps, duration_min, calories_burned, done (0/1) |
| `foods`    | Food list for search: name, category, serving, calories, macros, source (builtin / custom / ai) |

The built-in Malaysian foods are in `server/foods-seed.js` and are added automatically.
Calorie values are typical-portion estimates; edit that file to adjust them or add more.

The schema is in `server/db.js`. To look at the data, open `server/health.db`
with [DB Browser for SQLite](https://sqlitebrowser.org/).

## API

| Method | URL | Purpose |
|--------|-----|---------|
| GET/PUT | `/api/settings` | Read / change calorie goal |
| GET | `/api/meals?date=YYYY-MM-DD` | Meals for a day |
| POST | `/api/meals` | Add a meal |
| DELETE | `/api/meals/:id` | Remove a meal |
| GET | `/api/workouts?date=YYYY-MM-DD` | Workouts for a day |
| POST | `/api/workouts` | Add an exercise |
| PATCH | `/api/workouts/:id/toggle` | Tick / untick |
| DELETE | `/api/workouts/:id` | Remove an exercise |
| POST | `/api/workouts/copy` | Copy one day's list to another (`{from, to}`) |
| GET | `/api/summary` | Last 7 days: eaten, burned, workouts done |
| GET | `/api/foods?q=nasi` | Search the food list |
| POST | `/api/foods` | Save a food to your own list |
| GET | `/api/ai/status` | Is the AI key set up? |
| POST | `/api/ai/estimate` | `{text, image}` → estimated items with calories |
