// ============================================================
// fintrack mobile — Auth context
// File: src/context/AuthContext.js
// Version: 1.0 — 2026-04-20
// ============================================================

import React, { createContext, useContext, useState, useCallback } from 'react'
import * as SecureStore from 'expo-secure-store'
import { auth, setAuthHeaders, clearAuthHeaders } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [token, setToken]       = useState(null)
  const [password, setPassword] = useState(null)
  const [loading, setLoading]   = useState(false)

  const login = useCallback(async (email, pwd) => {
    setLoading(true)
    try {
      const { data } = await auth.login(email, pwd)
      if (data.mfa_required) {
        setLoading(false)
        return {
          mfa_required:  true,
          mfa_type:      data.mfa_type,
          pending_token: data.access_token,
          email,
          pwd,
        }
      }
      await _completeLogin(data, pwd)
      setLoading(false)
      return { mfa_required: false }
    } catch (err) {
      setLoading(false)
      throw err
    }
  }, [])

  const completeMFALogin = useCallback(async (pendingToken, mfaCode, email, pwd) => {
    setLoading(true)
    try {
      await auth.mfaChallenge(mfaCode, pendingToken)
      const { data } = await auth.login(email, pwd)
      await _completeLogin(data, pwd)
      setLoading(false)
    } catch (err) {
      setLoading(false)
      throw err
    }
  }, [])

  async function _completeLogin(data, pwd) {
    setToken(data.access_token)
    setUser({ email: data.email, id: data.user_id })
    setPassword(pwd)
    setAuthHeaders(data.access_token, pwd)
    await SecureStore.setItemAsync('refresh_token', data.refresh_token)
  }

  const logout = useCallback(async () => {
    setUser(null)
    setToken(null)
    setPassword(null)
    clearAuthHeaders()
    await SecureStore.deleteItemAsync('refresh_token').catch(() => {})
  }, [])

  const refreshToken = useCallback(async () => {
    try {
      const rt = await SecureStore.getItemAsync('refresh_token')
      if (!rt) return false
      const { data } = await auth.refresh(rt)
      setToken(data.access_token)
      setAuthHeaders(data.access_token, password)
      await SecureStore.setItemAsync('refresh_token', data.refresh_token)
      return true
    } catch {
      return false
    }
  }, [password])

  return (
    <AuthContext.Provider value={{
      user, token, password, loading,
      isLoggedIn: !!user,
      login, logout, completeMFALogin, refreshToken,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
