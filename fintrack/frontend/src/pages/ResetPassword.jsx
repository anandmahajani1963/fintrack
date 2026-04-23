// ============================================================
// fintrack — Reset Password page
// File: src/pages/ResetPassword.jsx
// Version: 1.0 — 2026-04-23
// ============================================================

import React, { useState, useEffect } from 'react'
import { TrendingUp, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function ResetPassword() {
  const [token, setToken]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  useEffect(() => {
    // Extract token from URL query string
    const params = new URLSearchParams(window.location.search)
    const t = params.get('token')
    if (t) setToken(t)
    else setError('Invalid reset link — no token found.')
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 10) { setError('Password must be at least 10 characters'); return }
    if (!/[A-Z]/.test(password)) { setError('Password must contain an uppercase letter'); return }
    if (!/[0-9]/.test(password)) { setError('Password must contain a number'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    setLoading(true); setError('')
    try {
      const r = await fetch('/api/v1/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Reset failed')
      setDone(true)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center
                          justify-center mb-3">
            <TrendingUp className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reset password
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            fintrack — choose a new password
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle size={48} className="text-green-500 mx-auto" />
              <p className="font-semibold text-gray-900 dark:text-white text-lg">
                Password updated!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your password has been changed successfully.
              </p>
              <a href="/"
                 className="block w-full py-2.5 rounded-lg bg-blue-600
                            hover:bg-blue-700 text-white font-medium text-sm
                            text-center transition-colors">
                Go to sign in
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700
                                   dark:text-gray-300 mb-1">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2
                                   text-gray-400" size={16} />
                  <input type={showPwd ? 'text' : 'password'} required
                         value={password} onChange={e => setPassword(e.target.value)}
                         className="w-full pl-9 pr-9 py-2.5 rounded-lg border
                                    border-gray-300 dark:border-gray-600
                                    bg-white dark:bg-gray-700
                                    text-gray-900 dark:text-white
                                    focus:ring-2 focus:ring-blue-500
                                    focus:border-transparent text-sm outline-none"
                         placeholder="Min 10 chars, uppercase, number" />
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2
                                     text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700
                                   dark:text-gray-300 mb-1">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2
                                   text-gray-400" size={16} />
                  <input type="password" required
                         value={confirm} onChange={e => setConfirm(e.target.value)}
                         className="w-full pl-9 pr-3 py-2.5 rounded-lg border
                                    border-gray-300 dark:border-gray-600
                                    bg-white dark:bg-gray-700
                                    text-gray-900 dark:text-white
                                    focus:ring-2 focus:ring-blue-500
                                    focus:border-transparent text-sm outline-none"
                         placeholder="Re-enter password" />
                </div>
              </div>

              {/* Strength hints */}
              <div className="space-y-1">
                {[
                  ['At least 10 characters', password.length >= 10],
                  ['One uppercase letter',   /[A-Z]/.test(password)],
                  ['One number',             /[0-9]/.test(password)],
                  ['Passwords match',        confirm.length > 0 && password === confirm],
                ].map(([label, ok]) => (
                  <p key={label} className={`text-xs flex items-center gap-1.5
                    ${ok ? 'text-green-600 dark:text-green-400'
                         : 'text-gray-400 dark:text-gray-500'}`}>
                    <span>{ok ? '✓' : '○'}</span> {label}
                  </p>
                ))}
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50
                              dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <button type="submit" disabled={loading || !token}
                      className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700
                                 disabled:opacity-50 text-white font-medium text-sm
                                 transition-colors">
                {loading ? 'Updating…' : 'Set new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
