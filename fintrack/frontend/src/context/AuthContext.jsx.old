// ============================================================
// fintrack — Auth context
// File: src/context/AuthContext.jsx
// Version: 1.0 — 2026-03-26
// ============================================================

import React, { createContext, useContext, useState, useCallback } from 'react'
import { auth } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [password, setPassword] = useState('')  // kept in memory for API calls needing it

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
