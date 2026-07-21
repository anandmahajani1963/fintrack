// ============================================================
// fintrack — Registration page
// File: src/pages/Register.jsx
// Version: 1.0 — 2026-04-06
// ============================================================

import React, { useState } from 'react'
import { TrendingUp, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function Register({ onRegistered, onBack }) {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  function validate() {
    if (!email)    return 'Email is required'
    if (password.length < 10) return 'Password must be at least 10 characters'
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter'
    if (!/[0-9]/.test(password)) return 'Password must contain a number'
    if (password !== confirm) return 'Passwords do not match'
    if (!acknowledged) return 'Please acknowledge the password warning'
    if (!termsAccepted) return 'Please accept the Terms of Service'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setLoading(true); setError('')

    try {
      const r = await fetch('/api/v1/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Registration failed')
      // Auto-login after registration
      const loginR = await fetch('/api/v1/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      })
      const loginData = await loginR.json()
      if (!loginR.ok) throw new Error('Registration succeeded but login failed')
      onRegistered(loginData, password)
    } catch (err) {
      setError(err.message || String(err))
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
            Create account
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            fintrack — personal finance tracker
          </p>
        </div>

        <form onSubmit={handleSubmit}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700
                               dark:text-gray-300 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2
                               text-gray-400" size={16} />
              <input type="email" required value={email}
                     onChange={e => setEmail(e.target.value)}
                     className="w-full pl-9 pr-3 py-2.5 rounded-lg border
                                border-gray-300 dark:border-gray-600
                                bg-white dark:bg-gray-700
                                text-gray-900 dark:text-white
                                focus:ring-2 focus:ring-blue-500
                                focus:border-transparent text-sm outline-none"
                     placeholder="you@email.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700
                               dark:text-gray-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2
                               text-gray-400" size={16} />
              <input type={showPwd ? 'text' : 'password'} required
                     value={password}
                     onChange={e => setPassword(e.target.value)}
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
              <input type="password" required value={confirm}
                     onChange={e => setConfirm(e.target.value)}
                     className="w-full pl-9 pr-3 py-2.5 rounded-lg border
                                border-gray-300 dark:border-gray-600
                                bg-white dark:bg-gray-700
                                text-gray-900 dark:text-white
                                focus:ring-2 focus:ring-blue-500
                                focus:border-transparent text-sm outline-none"
                     placeholder="Re-enter password" />
            </div>
          </div>

          {/* Password strength hints */}
          <div className="space-y-1">
            {[
              ['At least 10 characters', password.length >= 10],
              ['One uppercase letter',  /[A-Z]/.test(password)],
              ['One number',            /[0-9]/.test(password)],
              ['Passwords match',       confirm.length > 0 && password === confirm],
            ].map(([label, ok]) => (
              <p key={label} className={`text-xs flex items-center gap-1.5
                ${ok ? 'text-green-600 dark:text-green-400'
                     : 'text-gray-400 dark:text-gray-500'}`}>
                <span>{ok ? '✓' : '○'}</span> {label}
              </p>
            ))}
          </div>

          {/* Password warning acknowledgment */}
          <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20
                          border border-amber-200 dark:border-amber-700
                          rounded-lg px-3 py-3">
            <input type="checkbox" id="ack" checked={acknowledged}
                   onChange={e => setAcknowledged(e.target.checked)}
                   className="mt-0.5 h-4 w-4 accent-blue-600 cursor-pointer flex-shrink-0" />
            <label htmlFor="ack" className="text-xs text-amber-800 dark:text-amber-300
                                            cursor-pointer leading-relaxed">
              I understand that my password <strong>cannot be recovered</strong>. 
              If I forget my password, my financial data will be permanently deleted 
              and I will start fresh.
            </label>
          </div>

          <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800/50
                          border border-gray-200 dark:border-gray-700
                          rounded-lg px-3 py-3">
            <input type="checkbox" id="terms" checked={termsAccepted}
                   onChange={e => setTermsAccepted(e.target.checked)}
                   className="mt-0.5 h-4 w-4 accent-blue-600 cursor-pointer flex-shrink-0" />
            <label htmlFor="terms" className="text-xs text-gray-600 dark:text-gray-400
                                              cursor-pointer leading-relaxed">
              I agree to the <a href="/terms.html" target="_blank" className="text-blue-600 underline">Terms of Service</a> and
              <a href="/privacy.html" target="_blank" className="text-blue-600 underline">Privacy Policy</a>.
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50
                          dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700
                             disabled:opacity-50 text-white font-medium text-sm
                             transition-colors">
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          <button type="button" onClick={onBack}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700
                             dark:text-gray-400 dark:hover:text-gray-200">
            ← Back to sign in
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your data is encrypted end-to-end. We never see your transactions.
        </p>
      </div>
    </div>
  )
}
