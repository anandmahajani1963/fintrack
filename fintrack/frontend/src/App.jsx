// ============================================================
// fintrack — App root component
// File: src/App.jsx
// Version: 1.4 — 2026-04-06
// Changes:
//   v1.3  2026-04-05  Added Budgets page
//   v1.4  2026-04-06  Added Register and MFASetup flows
// ============================================================

import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login          from './pages/Login'
import Register       from './pages/Register'
import MFASetup       from './pages/MFASetup'
import PasswordPrompt from './components/PasswordPrompt'
import Sidebar        from './components/Sidebar'
import Dashboard      from './pages/Dashboard'
import Categories     from './pages/Categories'
import Monthly        from './pages/Monthly'
import Transactions   from './pages/Transactions'
import Utilities      from './pages/Utilities'
import Members        from './pages/Members'
import Reconciliation from './pages/Reconciliation'
import Import         from './pages/Import'
import Budgets        from './pages/Budgets'

const PAGES = {
  dashboard:      Dashboard,
  categories:     Categories,
  monthly:        Monthly,
  transactions:   Transactions,
  utilities:      Utilities,
  members:        Members,
  reconciliation: Reconciliation,
  import:         Import,
  budgets:        Budgets,
}

function AppInner() {
  const {
    isLoggedIn, needsPassword,
    mfaSetupToken, startMFASetup, completeMFASetup,
    login,
  } = useAuth()

  const [page, setPage]       = useState('dashboard')
  const [year, setYear]       = useState(2025)
  const [showRegister, setShowRegister] = useState(false)

  // Show MFA setup if triggered after registration
  if (mfaSetupToken) {
    return (
      <MFASetup
        token={mfaSetupToken.token}
        email={mfaSetupToken.email}
        onComplete={completeMFASetup}
      />
    )
  }

  if (!isLoggedIn) {
    if (showRegister) {
      return (
        <Register
          onRegistered={(loginData, pwd) => {
            // After registration, trigger MFA setup
            // loginData.email comes from the login response after registration
            startMFASetup(loginData.access_token, loginData.email || '', pwd)
            setShowRegister(false)
          }}
          onBack={() => setShowRegister(false)}
        />
      )
    }
    return <Login onRegister={() => setShowRegister(true)} />
  }

  if (needsPassword) return <PasswordPrompt />

  const PageComponent = PAGES[page] || Dashboard

  function handleNavigate(newPage, newYear) {
    if (newPage) setPage(newPage)
    if (newYear) setYear(newYear)
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar active={page} onNavigate={handleNavigate} />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <PageComponent year={year} />
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
