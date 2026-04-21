// ============================================================
// fintrack mobile — App root
// File: App.js
// Version: 1.0 — 2026-04-20
// ============================================================

import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import LoginScreen  from './src/screens/LoginScreen'
import AppNavigator from './src/navigation/AppNavigator'

function AppInner() {
  const { isLoggedIn } = useAuth()
  const scheme = useColorScheme()

  return (
    <NavigationContainer>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {isLoggedIn ? <AppNavigator /> : <LoginScreen />}
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
