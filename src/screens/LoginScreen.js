// ============================================================
// fintrack mobile — Login screen
// File: src/screens/LoginScreen.js
// Version: 1.0 — 2026-04-20
// ============================================================

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, useColorScheme, Alert,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import { auth } from '../api/client'

export default function LoginScreen() {
  const { login, completeMFALogin, loading } = useAuth()
  const scheme = useColorScheme()
  const dark   = scheme === 'dark'
  const c      = dark ? darkColors : lightColors

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode]   = useState('')
  const [step, setStep]         = useState('login')  // 'login' | 'mfa'
  const [mfaType, setMfaType]   = useState('')
  const [pendingData, setPending] = useState(null)
  const [error, setError]       = useState('')
  const [busy, setBusy]         = useState(false)

  async function handleLogin() {
    if (!email || !password) { setError('Email and password required'); return }
    setError(''); setBusy(true)
    console.log('Attempting login:', email, 'pwd length:', password.length)
    try {
      const result = await login(email, password)
      if (result.mfa_required) {
        setPending(result)
        setMfaType(result.mfa_type)
        if (result.mfa_type === 'email') {
          await auth.sendLoginOTP(result.pending_token)
        }
        setStep('mfa')
      }
    } catch (err) {
      console.log('Login error:', JSON.stringify(err.response?.data))
      console.log('Error status:', err.response?.status)
      console.log('Error message:', err.message)
      setError(err.response?.data?.detail || 'Invalid email or password')
    }
    setBusy(false)
  }

  async function handleMFA() {
    if (!mfaCode || mfaCode.length !== 6) {
      setError('Enter the 6-digit code'); return
    }
    setError(''); setBusy(true)
    try {
      await completeMFALogin(
        pendingData.pending_token, mfaCode,
        pendingData.email, pendingData.pwd
      )
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid code')
    }
    setBusy(false)
  }

  async function resendOTP() {
    try {
      await auth.sendLoginOTP(pendingData.pending_token)
      Alert.alert('Code sent', 'A new code has been sent to your email.')
    } catch {
      setError('Failed to send code')
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={[styles.logo, { backgroundColor: '#2563EB' }]}>
          <Text style={styles.logoText}>ft</Text>
        </View>
        <Text style={[styles.title, { color: c.text }]}>fintrack</Text>
        <Text style={[styles.subtitle, { color: c.muted }]}>
          {step === 'login' ? 'Personal finance tracker' : 'Two-factor authentication'}
        </Text>

        <View style={[styles.card, { backgroundColor: c.card, shadowColor: c.shadow }]}>

          {step === 'login' && (
            <>
              <Text style={[styles.label, { color: c.muted }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.input, color: c.text,
                                        borderColor: c.border }]}
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.com"
                placeholderTextColor={c.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={[styles.label, { color: c.muted }]}>Password</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.input, color: c.text,
                                        borderColor: c.border }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••"
                placeholderTextColor={c.placeholder}
                secureTextEntry
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.btn, busy && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={busy || loading}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Sign in</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {step === 'mfa' && (
            <>
              <Text style={[styles.mfaHint, { color: c.muted }]}>
                {mfaType === 'totp'
                  ? 'Enter the 6-digit code from your authenticator app.'
                  : `Enter the 6-digit code sent to ${email}.`}
              </Text>

              <TextInput
                style={[styles.otpInput, { backgroundColor: c.input,
                                           color: c.text, borderColor: c.border }]}
                value={mfaCode}
                onChangeText={t => setMfaCode(t.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={c.placeholder}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.btn, (busy || mfaCode.length !== 6) && styles.btnDisabled]}
                onPress={handleMFA}
                disabled={busy || mfaCode.length !== 6}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Verify</Text>
                }
              </TouchableOpacity>

              {mfaType === 'email' && (
                <TouchableOpacity onPress={resendOTP} style={styles.linkBtn}>
                  <Text style={[styles.linkText, { color: c.accent }]}>Resend code</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => { setStep('login'); setMfaCode(''); setError('') }}
                style={styles.linkBtn}
              >
                <Text style={[styles.linkText, { color: c.muted }]}>← Back to sign in</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={[styles.footer, { color: c.muted }]}>
          End-to-end encrypted · Your data stays private
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const lightColors = {
  bg: '#F9FAFB', card: '#FFFFFF', text: '#111827', muted: '#6B7280',
  input: '#F3F4F6', border: '#E5E7EB', placeholder: '#9CA3AF',
  accent: '#2563EB', shadow: '#000',
}
const darkColors = {
  bg: '#111827', card: '#1F2937', text: '#F9FAFB', muted: '#9CA3AF',
  input: '#374151', border: '#4B5563', placeholder: '#6B7280',
  accent: '#60A5FA', shadow: '#000',
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  inner:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo:       { width: 64, height: 64, borderRadius: 16, alignItems: 'center',
                justifyContent: 'center', marginBottom: 12 },
  logoText:   { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  title:      { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
  subtitle:   { fontSize: 14, marginBottom: 32 },
  card:       { width: '100%', maxWidth: 400, borderRadius: 16, padding: 24,
                shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
                shadowRadius: 8, elevation: 4 },
  label:      { fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  input:      { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14,
                paddingVertical: 12, fontSize: 15, marginBottom: 4 },
  otpInput:   { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14,
                paddingVertical: 16, fontSize: 28, textAlign: 'center',
                letterSpacing: 12, marginBottom: 4, marginTop: 8 },
  mfaHint:    { fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  error:      { color: '#EF4444', fontSize: 13, marginBottom: 8, marginTop: 4 },
  btn:        { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 14,
                alignItems: 'center', marginTop: 16 },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkBtn:    { alignItems: 'center', marginTop: 12 },
  linkText:   { fontSize: 14 },
  footer:     { fontSize: 12, marginTop: 32, textAlign: 'center' },
})
