// ============================================================
// fintrack mobile — API client
// File: src/api/client.js
// Version: 1.1 — 2026-04-20 — switched to fetch (axios blocked by Expo Go)
// ============================================================

export const API_BASE = 'http://192.168.1.170:30800'

let _token    = null
let _password = null

export function setAuthHeaders(token, password) {
  _token    = token
  _password = password
}

export function clearAuthHeaders() {
  _token    = null
  _password = null
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (_token)    headers['Authorization']       = `Bearer ${_token}`
  if (_password) headers['X-Fintrack-Password'] = _password

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.detail || `HTTP ${res.status}`)
    err.response = { status: res.status, data }
    throw err
  }
  return { data }
}

export const auth = {
  login: (email, password) =>
    apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refresh_token) =>
    apiFetch('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token }),
    }),

  mfaChallenge: (code, token) =>
    apiFetch('/api/v1/mfa/challenge', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    }),

  sendLoginOTP: (token) =>
    apiFetch('/api/v1/mfa/send-login-otp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
}

export const analytics = {
  categorySummary: (year) =>
    apiFetch(`/api/v1/analytics/category-summary?year=${year}`),

  monthlyTrend: (year) =>
    apiFetch(`/api/v1/analytics/trend?year=${year}`),

  budgetStatus: (year) =>
    apiFetch(`/api/v1/budget/status?year=${year}`),
}

export const transactions = {
  list: (params) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/api/v1/transactions?${qs}`)
  },
}

export default { auth, analytics, transactions }