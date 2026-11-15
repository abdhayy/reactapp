// Small helper for talking to the backend.
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getSettings: () => request('/settings'),
  setGoal: (calorie_goal) => request('/settings', { method: 'PUT', body: { calorie_goal } }),

  getMeals: (date) => request(`/meals?date=${date}`),
  addMeal: (meal) => request('/meals', { method: 'POST', body: meal }),
  deleteMeal: (id) => request(`/meals/${id}`, { method: 'DELETE' }),

  getWorkouts: (date) => request(`/workouts?date=${date}`),
  addWorkout: (w) => request('/workouts', { method: 'POST', body: w }),
  toggleWorkout: (id) => request(`/workouts/${id}/toggle`, { method: 'PATCH' }),
  deleteWorkout: (id) => request(`/workouts/${id}`, { method: 'DELETE' }),
  copyWorkouts: (from, to) => request('/workouts/copy', { method: 'POST', body: { from, to } }),

  getSummary: () => request('/summary'),

  searchFoods: (q) => request(`/foods?q=${encodeURIComponent(q)}`),
  saveFood: (food) => request('/foods', { method: 'POST', body: food }),
  deleteFood: (id) => request(`/foods/${id}`, { method: 'DELETE' }),

  aiStatus: () => request('/ai/status'),
  aiEstimate: (text, image) => request('/ai/estimate', { method: 'POST', body: { text, image } }),
};

export const toDateStr = (d) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
export const shiftDate = (dateStr, days) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toDateStr(d);
};
