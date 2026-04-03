// ============================================================
// fintrack — API client
// File: src/api/client.js
// Version: 1.0 — 2026-03-26
//
// All API calls go through this module.
// Token is stored in memory (not localStorage) for security.
// ============================================================

//const API_BASE = import.meta.env.VITE_API_BASE || 'http://192.168.1.170:8000'
const API_BASE = ''

// In-memory token storage — never touches localStorage
let _token = null
let _email = null

export const auth = {
  isLoggedIn: () => !!_token,
  email:      () => _email,

  async login(email, password) {
    const r = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    if (!r.ok) throw new Error('Invalid email or password')
    const data = await r.json()
    _token = data.access_token
    _email = data.email
    // Store refresh token for session recovery
    sessionStorage.setItem('refresh_token', data.refresh_token)
    return data
  },

  async refresh() {
    const refreshToken = sessionStorage.getItem('refresh_token')
    if (!refreshToken) throw new Error('No refresh token')
    const r = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!r.ok) throw new Error('Session expired — please log in again')
    const data = await r.json()
    _token = data.access_token
    sessionStorage.setItem('refresh_token', data.refresh_token)
    return data
  },

  logout() {
    _token = null
    _email = null
    sessionStorage.removeItem('refresh_token')
  }
}

// Core fetch with auto-refresh on 401
async function apiFetch(path, options = {}) {
  if (!_token) throw new Error('Not authenticated')

  const doFetch = (token) => fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  let r = await doFetch(_token)

  // Auto-refresh on token expiry
  if (r.status === 401) {
    await auth.refresh()
    r = await doFetch(_token)
  }

  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }))
    throw new Error(err.detail || `API error ${r.status}`)
  }

  return r.json()
}

// ── Analytics endpoints ────────────────────────────────────────────────────

export const analytics = {
  categorySummary: (year) =>
    apiFetch(`/api/v1/analytics/category-summary${year ? `?year=${year}` : ''}`),

  monthlyPivot: (year) =>
    apiFetch(`/api/v1/analytics/monthly-pivot${year ? `?year=${year}` : ''}`),

  trend: (year, category) => {
    const params = new URLSearchParams()
    if (year)     params.set('year', year)
    if (category) params.set('category', category)
    return apiFetch(`/api/v1/analytics/trend?${params}`)
  },

  essentialSplit: (year) =>
    apiFetch(`/api/v1/analytics/essential-split${year ? `?year=${year}` : ''}`),

  largeExpenses: (password, year, threshold = 200) => {
    const params = new URLSearchParams({ password, threshold })
    if (year) params.set('year', year)
    return apiFetch(`/api/v1/analytics/large-expenses?${params}`)
  },

  utilitySeasonal: (year) =>
    apiFetch(`/api/v1/analytics/utility-seasonal${year ? `?year=${year}` : ''}`),
}

// ── Transaction endpoints ──────────────────────────────────────────────────

export const transactions = {
  list: (password, params = {}) => {
    const p = new URLSearchParams({ password, page_size: 50, ...params })
    return apiFetch(`/api/v1/transactions?${p}`)
  },

  accounts: (password) =>
    apiFetch(`/api/v1/transactions/accounts?password=${password}`),
}
