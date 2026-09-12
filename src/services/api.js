/**
 * API Service for Central Trading System (CTS)
 */

const BASE_URL = '/api';

function getHeaders() {
  const token = localStorage.getItem('cts_token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: getHeaders(),
    ...options
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || `Request failed with status ${res.status}`);
      error.status = res.status;
      error.errorCode = data.errorCode;
      error.data = data;
      throw error;
    }
    return data;
  } catch (err) {
    throw err;
  }
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  register: (data) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getMe: () => request('/auth/me'),

  // Account (R06)
  getMyAccount: () => request('/accounts/me'),
  depositFunds: (amount) => request('/accounts/deposit', {
    method: 'POST',
    body: JSON.stringify({ amount })
  }),

  // Stocks (R04)
  getStocks: () => request('/stocks'),
  getStock: (id) => request(`/stocks/${id}`),
  updateStockLimits: (id, limits) => request(`/stocks/${id}/limits`, {
    method: 'PATCH',
    body: JSON.stringify(limits)
  }),

  // Instructions (R01, R02)
  createInstruction: (instruction) => request('/instructions', {
    method: 'POST',
    body: JSON.stringify(instruction)
  }),
  getInstructions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/instructions${query ? `?${query}` : ''}`);
  },
  cancelInstruction: (id) => request(`/instructions/${id}/cancel`, {
    method: 'PATCH'
  }),

  // Matching & Order Book (R03)
  getOrderBook: (stockId = '') => request(`/matching/order-book${stockId ? `/${stockId}` : ''}`),
  runMatching: (stockId = null) => request('/matching/run', {
    method: 'POST',
    body: JSON.stringify({ stockId })
  }),

  // Trades
  getTrades: (stockId = '') => request(`/queries/trades${stockId ? `?stockId=${stockId}` : ''}`),

  // Queries (R07)
  userQuery: (params) => {
    const query = new URLSearchParams(params).toString();
    return request(`/queries/user?${query}`);
  },
  stockQuery: (params) => {
    const query = new URLSearchParams(params).toString();
    return request(`/queries/stock?${query}`);
  },

  // Manager (R10)
  getManagerOverview: () => request('/manager/overview'),
  toggleSuspension: (suspended) => request('/manager/suspend', {
    method: 'POST',
    body: JSON.stringify({ suspended })
  }),
  triggerOutdatedSweep: (maxAgeHours) => request('/manager/outdated-sweep', {
    method: 'POST',
    body: JSON.stringify({ maxAgeHours })
  }),
  getSystemLogs: () => request('/manager/logs'),
  resetDatabase: () => request('/manager/reset', {
    method: 'POST'
  })
};

export default api;
