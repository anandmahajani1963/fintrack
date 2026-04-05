// ============================================================
// fintrack — API client
// File: src/api/client.js
// Version: 1.2 — 2026-03-30
// Changes:
//   v1.0  2026-03-26  Initial implementation
//   v1.1  2026-03-27  Fixed CORS — use relative paths through nginx proxy
//   v1.2  2026-03-30  Password moved to X-Fintrack-Password header
//   v1.3  2026-03-31  Added members analytics endpoint
//                     Added transaction category update endpoint
//                     Eliminated password from all URLs and query strings
// ============================================================

const API_BASE = ''  // empty = relative path through nginx proxy

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
    sessionStorage.setItem('refresh_token', data.refresh_token)
    return data
  },

  async tryRestoreSession() {
    // Called on app startup — silently restore session from refresh token
    const refreshToken = sessionStorage.getItem('refresh_token')
    if (!refreshToken) return false
    try {
      const r = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!r.ok) {
        sessionStorage.removeItem('refresh_token')
        return false
      }
      const data = await r.json()
      _token = data.access_token
      _email = data.email
      sessionStorage.setItem('refresh_token', data.refresh_token)
      return true
    } catch {
      sessionStorage.removeItem('refresh_token')
      return false
    }
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
// password param → X-Fintrack-Password header (never in URL)
async function apiFetch(path, options = {}, password = null) {
  if (!_token) throw new Error('Not authenticated')

  const headers = {
    'Content-Type':         'application/json',
    'Authorization':        `Bearer ${_token}`,
    ...options.headers,
  }

  // Add password as header if provided — never as query param
  if (password) {
    headers['X-Fintrack-Password'] = password
  }

  const doFetch = (token) => fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, 'Authorization': `Bearer ${token}` },
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

  // Password sent as X-Fintrack-Password header — not in URL
  largeExpenses: (password, year, threshold = 200) => {
    const params = new URLSearchParams({ threshold })
    if (year) params.set('year', year)
    return apiFetch(`/api/v1/analytics/large-expenses?${params}`, {}, password)
  },

  utilitySeasonal: (year) =>
    apiFetch(`/api/v1/analytics/utility-seasonal${year ? `?year=${year}` : ''}`),

  members: (year) =>
    apiFetch(`/api/v1/analytics/members${year ? `?year=${year}` : ''}`),
}

// ── Transaction endpoints ──────────────────────────────────────────────────

export const transactions = {
  // Password sent as X-Fintrack-Password header — not in URL
  list: (password, params = {}) => {
    const p = new URLSearchParams({ page_size: 50, ...params })
    return apiFetch(`/api/v1/transactions?${p}`, {}, password)
  },

  accounts: (password) =>
    apiFetch('/api/v1/transactions/accounts', {}, password),

  // All defined categories regardless of spend — for dropdowns
  categories: () =>
    apiFetch('/api/v1/transactions/categories'),

  // Create a new category
  createCategory: (data) =>
    apiFetch('/api/v1/transactions/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // All defined categories regardless of spend — for dropdowns
  categories: () =>
    apiFetch('/api/v1/transactions/categories'),

  // Create a new category
  createCategory: (data) =>
    apiFetch('/api/v1/transactions/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Update category of a single transaction (used by Reconciliation page)
  updateCategory: (transactionId, categoryName, subcategory) =>
    apiFetch(`/api/v1/transactions/${transactionId}/category`, {
      method: 'PATCH',
      body: JSON.stringify({ category_name: categoryName, subcategory }),
    }),
}
