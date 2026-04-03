// ============================================================
// fintrack — Password prompt component
// File: src/components/PasswordPrompt.jsx
// Version: 1.0 — 2026-03-31
// Purpose: Shown after page refresh when session is restored
//          but password (used for key derivation) needs re-entry.
// ============================================================

import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Lock, KeyRound } from 'lucide-react'

export default function PasswordPrompt() {
  const { user, supplyPassword, logout } = useAuth()
  const [pwd, setPwd]     = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pwd) return
    setLoading(true); setError('')
    try {
      // Verify password is correct by calling a password-requiring endpoint
      const r = await fetch('/api/v1/transactions/accounts', {
        headers: {
          'Authorization':       `Bearer ${sessionStorage.getItem('refresh_token') || ''}`,
          'X-Fintrack-Password': pwd,
        }
      })
      // We just need to check it doesn't return 422
      // 401 is fine (token expired — auth handles that separately)
      if (r.status === 422) {
        setError('Incorrect password — please try again')
        setLoading(false)
        return
      }
      supplyPassword(pwd)
    } catch {
      supplyPassword(pwd)  // Accept optimistically — API will validate
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center
                          justify-center mb-3">
            <KeyRound className="text-white" size={26} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Re-enter your password
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
            Welcome back, {user?.email}.<br />
            Your session was restored. Enter your password to decrypt your data.
          </p>
        </div>

        <form onSubmit={handleSubmit}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700
                               dark:text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2
                               text-gray-400" size={15} />
              <input
                type="password"
                required
                autoFocus
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border
                           border-gray-300 dark:border-gray-600
                           bg-white dark:bg-gray-700
                           text-gray-900 dark:text-white
                           focus:ring-2 focus:ring-blue-500
                           focus:border-transparent text-sm outline-none"
                placeholder="••••••••••"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50
                          dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !pwd}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 text-white font-medium text-sm
                       transition-colors"
          >
            {loading ? 'Verifying…' : 'Continue'}
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700
                       dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Sign out and log in again
          </button>
        </form>
      </div>
    </div>
  )
}
