// ============================================================
// fintrack — Budgets page
// File: src/pages/Budgets.jsx
// Version: 1.0 — 2026-04-05
// ============================================================

import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card, Loading, ErrorMsg, SectionTitle, fmt, fmtDec } from '../components/ui'
import { CheckCircle, AlertTriangle, XCircle,
         Plus, Trash2, Save } from 'lucide-react'

const API = ''

async function apiFetch(path, token, options = {}) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    }
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }))
    throw new Error(err.detail || `Error ${r.status}`)
  }
  return r.json()
}

function getToken() {
  // Access the in-memory token via a refresh
  return sessionStorage.getItem('refresh_token')
}

// Traffic light icon
function StatusIcon({ status, size = 20 }) {
  if (status === 'red')   return <XCircle size={size} className="text-red-500 flex-shrink-0" />
  if (status === 'amber') return <AlertTriangle size={size} className="text-amber-500 flex-shrink-0" />
  return <CheckCircle size={size} className="text-green-500 flex-shrink-0" />
}

// Progress bar
function BudgetBar({ pct, status }) {
  const colors = {
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red:   'bg-red-500',
  }
  return (
    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colors[status]}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

export default function Budgets({ year }) {
  const { password }            = useAuth()
  const [status, setStatus]     = useState(null)
  const [thresholds, setThresholds] = useState([])
  const [categories, setCategories] = useState([])
  const [error, setError]       = useState('')
  const [token, setToken]       = useState('')

  // New threshold form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({
    category_name: '', subcategory: '', period: 'monthly', threshold: ''
  })
  const [formError, setFormError] = useState('')
  const [saving, setSaving]       = useState(false)

  // Get fresh token via refresh
  useEffect(() => {
    const rt = sessionStorage.getItem('refresh_token')
    if (!rt) return
    fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt })
    })
      .then(r => r.json())
      .then(d => {
        setToken(d.access_token)
        sessionStorage.setItem('refresh_token', d.refresh_token)
      })
      .catch(() => {})
  }, [])

  const loadAll = useCallback(() => {
    if (!token) return
    setError('')

    Promise.all([
      apiFetch(`/api/v1/budget/status?year=${year}`, token),
      apiFetch('/api/v1/budget/thresholds', token),
      apiFetch('/api/v1/transactions/categories', token),
    ])
      .then(([s, t, c]) => {
        setStatus(s)
        setThresholds(t)
        setCategories(c.filter(x => x.name !== 'Other'))
      })
      .catch(e => setError(e.message))
  }, [token, year])

  useEffect(() => { loadAll() }, [loadAll])

  // Auto-fill subcategory when category changes
  function handleCategoryChange(catName) {
    const cat = categories.find(c => c.name === catName)
    setForm(f => ({
      ...f,
      category_name: catName,
      subcategory: cat?.subcategory || catName,
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.category_name || !form.threshold) {
      setFormError('Category and amount are required'); return
    }
    setSaving(true); setFormError('')
    try {
      await apiFetch('/api/v1/budget/thresholds', token, {
        method: 'PUT',
        body: JSON.stringify({
          category_name: form.category_name,
          subcategory:   form.subcategory || form.category_name,
          period:        form.period,
          threshold:     parseFloat(form.threshold),
        })
      })
      setForm({ category_name: '', subcategory: '', period: 'monthly', threshold: '' })
      setShowForm(false)
      loadAll()
    } catch (err) {
      setFormError(err.message)
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/api/v1/budget/thresholds/${id}`, token, { method: 'DELETE' })
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!token)   return <Loading />
  if (error)    return <ErrorMsg message={error} />
  if (!status)  return <Loading />

  const { budgets, alerts, summary } = status

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Spending vs thresholds — {year}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setFormError('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg
                     bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          <Plus size={15} />
          Set Budget
        </button>
      </div>

      {/* Summary pills */}
      {budgets.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'On track',     count: summary.green, color: 'green' },
            { label: 'Near limit',   count: summary.amber, color: 'amber' },
            { label: 'Over budget',  count: summary.red,   color: 'red'   },
          ].map(({ label, count, color }) => count > 0 && (
            <div key={color}
                 className={`px-4 py-2 rounded-xl border text-sm font-medium
                   ${color === 'green'
                     ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                     : color === 'amber'
                     ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                     : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                   }`}>
              {count} {label}
            </div>
          ))}
        </div>
      )}

      {/* Add budget form */}
      {showForm && (
        <Card>
          <SectionTitle>Set Budget Threshold</SectionTitle>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500
                                   dark:text-gray-400 uppercase mb-1">Category *</label>
                <select
                  value={form.category_name}
                  onChange={e => handleCategoryChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border
                             border-gray-200 dark:border-gray-600
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select category…</option>
                  {[...new Set(categories.map(c => c.name))].sort().map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500
                                   dark:text-gray-400 uppercase mb-1">Period</label>
                <select
                  value={form.period}
                  onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border
                             border-gray-200 dark:border-gray-600
                             bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500
                                 dark:text-gray-400 uppercase mb-1">
                Budget Amount ($) *
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.threshold}
                onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))}
                placeholder={form.period === 'monthly' ? 'e.g. 500' : 'e.g. 6000'}
                className="w-full px-3 py-2 text-sm rounded-lg border
                           border-gray-200 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {form.threshold && form.period === 'monthly' && (
                <p className="text-xs text-gray-400 mt-1">
                  Annual equivalent: {fmtDec(parseFloat(form.threshold || 0) * 12)}
                </p>
              )}
              {form.threshold && form.period === 'annual' && (
                <p className="text-xs text-gray-400 mt-1">
                  Monthly equivalent: {fmtDec(parseFloat(form.threshold || 0) / 12)}
                </p>
              )}
            </div>

            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50
                            dark:bg-red-900/20 rounded-lg px-3 py-2">{formError}</p>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg
                                 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                 text-white font-medium text-sm">
                <Save size={14} />
                {saving ? 'Saving…' : 'Save Budget'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                      className="px-4 py-2 rounded-lg border border-gray-200
                                 dark:border-gray-600 text-gray-600 dark:text-gray-400
                                 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* No budgets set yet */}
      {budgets.length === 0 && !showForm && (
        <Card>
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm mb-3">No budgets set yet</p>
            <button onClick={() => setShowForm(true)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700
                               text-white text-sm font-medium">
              Set your first budget
            </button>
          </div>
        </Card>
      )}

      {/* Budget status cards */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {budgets.map((b, i) => (
            <Card key={i} className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <StatusIcon status={b.status} size={18} />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      {b.category_name}
                      {b.subcategory && b.subcategory !== b.category_name &&
                        <span className="text-gray-400 font-normal"> / {b.subcategory}</span>}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{b.period} budget</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {fmtDec(b.spent)}
                    <span className="text-gray-400 font-normal"> / {fmtDec(b.threshold)}</span>
                  </p>
                  <p className={`text-xs font-medium
                    ${b.status === 'red'   ? 'text-red-500' :
                      b.status === 'amber' ? 'text-amber-500' : 'text-green-500'}`}>
                    {b.pct}% used
                  </p>
                </div>
              </div>

              <BudgetBar pct={b.pct} status={b.status} />

              <div className="flex justify-between mt-2 text-xs text-gray-400">
                {b.status === 'red' ? (
                  <span className="text-red-500 font-medium">
                    Over by {fmtDec(b.overage)}
                  </span>
                ) : (
                  <span className="text-gray-500">
                    {fmtDec(b.remaining)} remaining
                  </span>
                )}
                <span>{b.pct >= 100 ? '🔴' : b.pct >= 80 ? '🟡' : '🟢'}</span>
              </div>

              {/* Delete button */}
              <button
                onClick={() => {
                  const t = thresholds.find(
                    x => x.category_name === b.category_name && x.period === b.period
                  )
                  if (t) handleDelete(t.id)
                }}
                className="absolute top-3 right-3 p-1 text-gray-300
                           hover:text-red-500 dark:text-gray-600
                           dark:hover:text-red-400 transition-colors"
                title="Remove budget"
              >
                <Trash2 size={14} />
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* All thresholds list */}
      {thresholds.length > 0 && (
        <Card>
          <SectionTitle>All Budget Thresholds</SectionTitle>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr>
                {['Category','Period','Budget','Last Updated',''].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium
                                         text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {thresholds.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 px-3 text-gray-900 dark:text-white font-medium">
                    {t.category_name}
                    {t.subcategory && t.subcategory !== t.category_name &&
                      <span className="text-gray-400 font-normal"> / {t.subcategory}</span>}
                  </td>
                  <td className="py-2.5 px-3 capitalize text-gray-500">{t.period}</td>
                  <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">
                    {fmtDec(t.threshold)}
                  </td>
                  <td className="py-2.5 px-3 text-gray-400 text-xs">
                    {new Date(t.updated_at).toLocaleDateString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <button onClick={() => handleDelete(t.id)}
                            className="text-gray-300 hover:text-red-500 dark:text-gray-600
                                       dark:hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
