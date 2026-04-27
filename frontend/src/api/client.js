const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  getExpenses: (month) => request(`/api/expenses?month=${month}`),
  getExpense: (id) => request(`/api/expenses/${id}`),
  deleteExpense: (id) => request(`/api/expenses/${id}`, { method: 'DELETE' }),
  getStats: (month) => request(`/api/stats?month=${month}`),
  getYearlyStats: () => request('/api/stats/yearly'),
  getSws: () => request('/api/sws'),
  adjustSws: (delta, reason) => request('/api/sws/adjust', { method: 'POST', body: { delta, reason } }),
  getFixedExpenses: () => request('/api/fixed-expenses'),
  addFixedExpense: (name, amount) => request('/api/fixed-expenses', { method: 'POST', body: { name, amount } }),
  updateFixedExpense: (id, data) => request(`/api/fixed-expenses/${id}`, { method: 'PATCH', body: data }),
  deleteFixedExpense: (id) => request(`/api/fixed-expenses/${id}`, { method: 'DELETE' }),
};
