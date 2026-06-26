// ============================================================
// fintrack — Auth context
// File: src/context/AuthContext.jsx
// Version: 1.1 — 2026-03-30
// Changes:
//   v1.0  2026-03-26  Initial implementation
//   v1.1  2026-03-30  Added session restore on page refresh using
//                     refresh token stored in sessionStorage.
//                     Tab close = session ends (most secure).
//                     Password kept in memory only — never persisted.
// ============================================================

import React, {
  createContext, useContext, useState,
  useCallback, useEffect
} from 'react'
import { auth } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [password, setPassword] = useState('')
  const [restoring, setRestoring] = useState(true)  // true while checking session

  // On mount — silently try to restore session from refresh token
  // This fixes the "refresh = back to login" problem
  useEffect(() => {
    auth.tryRestoreSession().then(restored => {
      if (restored) {
        setUser({ email: auth.email() })
        // Note: password cannot be restored from sessionStorage (never stored)
        // User will be logged in but password-requiring features will prompt
        // them to re-enter password on first use — acceptable security tradeoff
      }
      setRestoring(false)
    })
  }, [])

  const login = useCallback(async (email, pwd) => {
    const data = await auth.login(email, pwd)
    setUser({ id: data.user_id, email: data.email })
    setPassword(pwd)
    return data
  }, [])

  const logout = useCallback(() => {
    auth.logout()
    setUser(null)
    setPassword('')
  }, [])

  // While checking sessionStorage, show nothing (avoids login flash)
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
    <AuthContext.Provider value={{ user, password, login, logout, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
