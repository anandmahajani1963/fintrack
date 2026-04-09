// ============================================================
// fintrack — Login page
// File: src/pages/Login.jsx
// Version: 1.1 — 2026-04-06
// Changes:
//   v1.0  2026-03-26  Initial implementation
//   v1.1  2026-04-06  Added MFA challenge step after password verification
//                     Added "Create account" link to Register page
// ============================================================

import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { TrendingUp, Lock, Mail } from 'lucide-react'

export default function Login({ onRegister }) {
  const { login, completeMFALogin } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode]   = useState('')
  const [step, setStep]         = useState('login')  // login | mfa
  const [mfaType, setMfaType]   = useState('')
  const [pendingToken, setPendingToken] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const data = await login(email, password)
      // login() in AuthContext handles mfa_required flag
      if (data.mfa_required) {
        setPendingToken(data.access_token)
        setMfaType(data.mfa_type)
        // Send OTP if email MFA
        if (data.mfa_type === 'email') {
          await fetch('/api/v1/mfa/send-login-otp', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${data.access_token}`,
            }
          })
        }
        setStep('mfa')
      }
      // If no mfa_required, login() already set the user state
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleMFA(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const r = await fetch('/api/v1/mfa/challenge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pendingToken}`,
        },
        body: JSON.stringify({ code: mfaCode.trim() })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Invalid code')
      // MFA verified — set user and password directly without re-triggering MFA check
      completeMFALogin(email, password, { user_id: '', email })
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function resendEmailOTP() {
    setError(''); setLoading(true)
    try {
      await fetch('/api/v1/mfa/send-login-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pendingToken}`,
        }
      })
      setError('New code sent to your email.')
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
            fintrack
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {step === 'login' ? 'Personal finance — zero knowledge'
                              : 'Two-factor authentication'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">

          {/* Step 1: Email + Password */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
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
                  <input type="password" required value={password}
                         onChange={e => setPassword(e.target.value)}
                         className="w-full pl-9 pr-3 py-2.5 rounded-lg border
                                    border-gray-300 dark:border-gray-600
                                    bg-white dark:bg-gray-700
                                    text-gray-900 dark:text-white
                                    focus:ring-2 focus:ring-blue-500
                                    focus:border-transparent text-sm outline-none"
                         placeholder="••••••••••" />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50
                              dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
              )}

              <button type="submit" disabled={loading}
                      className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700
                                 disabled:opacity-50 text-white font-medium text-sm
                                 transition-colors">
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <div className="text-center pt-1">
                <button type="button" onClick={onRegister}
                        className="text-sm text-blue-600 dark:text-blue-400
                                   hover:underline">
                  Create an account
                </button>
              </div>
            </form>
          )}

          {/* Step 2: MFA Code */}
          {step === 'mfa' && (
            <form onSubmit={handleMFA} className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                {mfaType === 'totp'
                  ? 'Enter the 6-digit code from your authenticator app.'
                  : `Enter the 6-digit code sent to ${email}.`}
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full px-4 py-3 rounded-lg border border-gray-300
                           dark:border-gray-600 bg-white dark:bg-gray-700
                           text-gray-900 dark:text-white text-center text-2xl
                           tracking-widest font-mono focus:ring-2
                           focus:ring-blue-500 outline-none"
              />

              {error && (
                <p className={`text-sm rounded-lg px-3 py-2
                               ${error.includes('sent')
                                 ? 'text-green-600 bg-green-50 dark:bg-green-900/20'
                                 : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'}`}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading || mfaCode.length !== 6}
                      className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700
                                 disabled:opacity-50 text-white font-medium text-sm">
                {loading ? 'Verifying…' : 'Verify'}
              </button>

              {mfaType === 'email' && (
                <button type="button" onClick={resendEmailOTP} disabled={loading}
                        className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
                  Resend code
                </button>
              )}

              <button type="button"
                      onClick={() => { setStep('login'); setMfaCode(''); setError('') }}
                      className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
                ← Back to sign in
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          Your data is encrypted end-to-end. We never see your transactions.
        </p>
      </div>
    </div>
  )
}
