// ============================================================
// fintrack — MFA Setup page (shown after first registration)
// File: src/pages/MFASetup.jsx
// Version: 1.0 — 2026-04-06
// ============================================================

import React, { useState } from 'react'
import { Shield, Smartphone, Mail, CheckCircle } from 'lucide-react'

export default function MFASetup({ token, email, onComplete }) {
  const [step, setStep]       = useState('choose')  // choose | totp | email | done
  const [qrImage, setQrImage] = useState('')
  const [secret, setSecret]   = useState('')
  const [code, setCode]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function apiFetch(path, options = {}) {
    const r = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      }
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.detail || `Error ${r.status}`)
    return data
  }

  async function startTOTP() {
    setLoading(true); setError('')
    try {
      const data = await apiFetch('/api/v1/mfa/setup/totp', { method: 'POST' })
      setQrImage(data.qr_image)
      setSecret(data.secret)
      setStep('totp')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  async function startEmail() {
    setLoading(true); setError('')
    try {
      await apiFetch('/api/v1/mfa/setup/email', { method: 'POST' })
      setStep('email')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  async function verifyTOTP() {
    setLoading(true); setError('')
    try {
      await apiFetch('/api/v1/mfa/verify/totp', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() })
      })
      setStep('done')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  async function verifyEmail() {
    setLoading(true); setError('')
    try {
      await apiFetch('/api/v1/mfa/verify/email', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() })
      })
      setStep('done')
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center
                    bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center
                          justify-center mb-3">
            <Shield className="text-white" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Set up two-factor authentication
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
            MFA is required to access fintrack. Choose your second factor.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">

          {/* Step: Choose method */}
          {step === 'choose' && (
            <div className="space-y-4">
              <button onClick={startTOTP} disabled={loading}
                      className="w-full flex items-center gap-4 p-4 rounded-xl
                                 border-2 border-blue-200 dark:border-blue-800
                                 hover:border-blue-400 dark:hover:border-blue-600
                                 hover:bg-blue-50 dark:hover:bg-blue-900/20
                                 transition-colors text-left">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40
                                flex items-center justify-center flex-shrink-0">
                  <Smartphone size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Authenticator app
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Google Authenticator, Authy, or any TOTP app
                  </p>
                </div>
              </button>

              <button onClick={startEmail} disabled={loading}
                      className="w-full flex items-center gap-4 p-4 rounded-xl
                                 border-2 border-gray-200 dark:border-gray-700
                                 hover:border-gray-400 dark:hover:border-gray-500
                                 hover:bg-gray-50 dark:hover:bg-gray-700/30
                                 transition-colors text-left">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700
                                flex items-center justify-center flex-shrink-0">
                  <Mail size={20} className="text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Email code
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Receive a 6-digit code at {email}
                  </p>
                </div>
              </button>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50
                              dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>
          )}

          {/* Step: TOTP — show QR code */}
          {step === 'totp' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Scan this QR code with your authenticator app, then enter
                the 6-digit code to confirm.
              </p>
              {qrImage && (
                <div className="flex justify-center">
                  <img src={qrImage} alt="QR Code" className="w-48 h-48 rounded-lg" />
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Or enter this code manually:
                </p>
                <p className="font-mono text-sm text-gray-900 dark:text-white
                              tracking-wider break-all">{secret}</p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-3 rounded-lg border border-gray-300
                           dark:border-gray-600 bg-white dark:bg-gray-700
                           text-gray-900 dark:text-white text-center text-xl
                           tracking-widest font-mono focus:ring-2
                           focus:ring-blue-500 outline-none"
              />
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <button onClick={verifyTOTP} disabled={loading || code.length !== 6}
                      className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700
                                 disabled:opacity-50 text-white font-medium text-sm">
                {loading ? 'Verifying…' : 'Verify and enable'}
              </button>
              <button onClick={() => { setStep('choose'); setCode(''); setError('') }}
                      className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
                ← Choose different method
              </button>
            </div>
          )}

          {/* Step: Email OTP */}
          {step === 'email' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                A 6-digit code has been sent to <strong>{email}</strong>.
                Enter it below to enable email MFA.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-3 rounded-lg border border-gray-300
                           dark:border-gray-600 bg-white dark:bg-gray-700
                           text-gray-900 dark:text-white text-center text-xl
                           tracking-widest font-mono focus:ring-2
                           focus:ring-blue-500 outline-none"
              />
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <button onClick={verifyEmail} disabled={loading || code.length !== 6}
                      className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700
                                 disabled:opacity-50 text-white font-medium text-sm">
                {loading ? 'Verifying…' : 'Verify and enable'}
              </button>
              <button onClick={() => startEmail()}
                      className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
                Resend code
              </button>
              <button onClick={() => { setStep('choose'); setCode(''); setError('') }}
                      className="w-full py-2 text-sm text-gray-400 hover:text-gray-600">
                ← Choose different method
              </button>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle size={48} className="text-green-500" />
              </div>
              <p className="font-semibold text-gray-900 dark:text-white text-lg">
                MFA enabled!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your account is now protected with two-factor authentication.
              </p>
              <button onClick={onComplete}
                      className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700
                                 text-white font-medium text-sm">
                Continue to fintrack
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
