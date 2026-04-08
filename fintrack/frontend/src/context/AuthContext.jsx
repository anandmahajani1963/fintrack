// ============================================================
// fintrack — Auth context
// File: src/context/AuthContext.jsx
// Version: 1.3 — 2026-04-06
// Changes:
//   v1.0  2026-03-26  Initial
//   v1.1  2026-03-30  Session restore on refresh
//   v1.2  2026-03-31  Password prompt after restore
//   v1.3  2026-04-06  MFA support — login returns mfa_required flag
//                     Registration flow with MFA setup
// ============================================================

import React, {
  createContext, useContext, useState,
  useCallback, useEffect
} from 'react'
import { auth } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [password, setPassword]   = useState('')
  const [restoring, setRestoring] = useState(true)
  const [needsPassword, setNeedsPassword] = useState(false)
  // MFA setup state — set after registration
  const [mfaSetupToken, setMfaSetupToken] = useState(null)

  useEffect(() => {
    auth.tryRestoreSession().then(restored => {
      if (restored) {
        setUser({ email: auth.email() })
        setNeedsPassword(true)
      }
      setRestoring(false)
    })
  }, [])

  const login = useCallback(async (email, pwd) => {
    const data = await auth.login(email, pwd)
    // If MFA required, don't set user yet — return data for caller to handle
    if (data.mfa_required) {
      return data
    }
    setUser({ id: data.user_id, email: data.email })
    setPassword(pwd)
    setNeedsPassword(false)
    return data
  }, [])

  const completeMFALogin = useCallback((email, pwd, userData) => {
    setUser({ id: userData.user_id, email })
    setPassword(pwd)
    setNeedsPassword(false)
  }, [])

  const startMFASetup = useCallback((token, email, pwd) => {
    setMfaSetupToken({ token, email, pwd })
  }, [])

  const completeMFASetup = useCallback(() => {
    if (mfaSetupToken) {
      setUser({ email: mfaSetupToken.email })
      setPassword(mfaSetupToken.pwd)
      setMfaSetupToken(null)
      setNeedsPassword(false)
    }
  }, [mfaSetupToken])

  const supplyPassword = useCallback((pwd) => {
    setPassword(pwd)
    setNeedsPassword(false)
  }, [])

  const logout = useCallback(() => {
    auth.logout()
    setUser(null)
    setPassword('')
    setNeedsPassword(false)
    setMfaSetupToken(null)
  }, [])

  if (restoring) {
    return (
      <div className="min-h-screen flex items-center justify-center
                      bg-gray-50 dark:bg-gray-900">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600
                        rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{
      user, password, login, logout,
      isLoggedIn: !!user,
      needsPassword, supplyPassword,
      mfaSetupToken, startMFASetup, completeMFASetup,
      completeMFALogin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
