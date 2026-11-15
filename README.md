# Health Tracker

Track your daily **calorie intake** and tick off your **workout checklist**.

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

## Database tables

| Table      | What it stores |
|------------|----------------|
| `settings` | Your daily calorie goal |
| `meals`    | date, meal_type (breakfast/lunch/dinner/snack), food_name, calories, protein_g, carbs_g, fat_g |
| `workouts` | date, exercise, sets, reps, duration_min, calories_burned, done (0/1) |

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
