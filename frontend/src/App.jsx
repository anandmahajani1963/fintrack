// ============================================================
// fintrack — App root component
// File: src/App.jsx
// Version: 1.5 — 2026-07-10
// Changes:
//   v1.3  2026-04-05  Added Budgets page
//   v1.4  2026-04-06  Added Register and MFASetup flows
//   v1.5  2026-07-10  Mobile responsive: hamburger menu, slide-out sidebar
// ============================================================

import React, { useState } from 'react'
import { useSessionTimeout } from './hooks/useSessionTimeout'
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
import Export         from './pages/Export'
import ResetPassword  from './pages/ResetPassword'
import Upgrade        from './pages/Upgrade'
import { Menu, TrendingUp } from 'lucide-react'

const PAGES = {
  dashboard:      Dashboard,
  categories:     Categories,
  monthly:        Monthly,
  transactions:   Transactions,
  utilities:      Utilities,
  members:        Members,
  reconciliation: Reconciliation,
  upgrade:         Upgrade,
  import:         Import,
  budgets:        Budgets,
  export:         Export,
}

function AppInner() {
  const {
    isLoggedIn, needsPassword,
    mfaSetupToken, startMFASetup, completeMFASetup,
    login, logout,
  } = useAuth()

  const [page, setPage]       = useState('dashboard')
  const [year, setYear]       = useState(2026)
  const [showRegister, setShowRegister] = useState(false)
  const [sidebarOpen, setSidebarOpen]   = useState(false)

  const { showWarn, countdown, stayLoggedIn } = useSessionTimeout(isLoggedIn, logout)

  // Allow any component to navigate via CustomEvent
  React.useEffect(() => {
    const handler = (e) => setPage(e.detail)
    window.addEventListener('navigate', handler)
    return () => window.removeEventListener('navigate', handler)
  }, [])

  // Detect Stripe checkout redirect and refresh plan
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("upgrade") === "success") {
      // Clean the URL
      window.history.replaceState({}, "", window.location.pathname)
      // Refresh token to get updated plan from backend
      fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: sessionStorage.getItem("refresh_token") || "" })
      })
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && d.plan) {
            // Force page reload to pick up new plan
            window.location.reload()
          }
        })
        .catch(() => {})
    }
  }, [])

  // Show password reset page when URL contains /reset-password
  if (window.location.pathname === '/reset-password') {
    return <ResetPassword />
  }

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
    setSidebarOpen(false)
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile top bar */}
      <div 
        className="fixed top-0 left-0 right-0 z-30 md:hidden
                   bg-white dark:bg-gray-900 border-b border-gray-200
                   dark:border-gray-700 px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800
                     text-gray-600 dark:text-gray-400"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <TrendingUp size={14} className="text-white" />
        </div>
        <span className="font-bold text-gray-900 dark:text-white text-base">fintrack</span>
      </div>

      <Sidebar
        active={page}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 p-4 md:p-6 overflow-auto
                       pt-[calc(4rem+env(safe-area-inset-top))] md:pt-6">
        <div className="max-w-6xl mx-auto">
          <PageComponent year={year} />
        </div>
      </main>

      {/* Session timeout warning */}
      {showWarn && (
        <div className="fixed inset-0 bg-black/50 flex items-center
                        justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl
                          p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-4xl mb-4">⏰</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Session expiring
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              You will be logged out in{' '}
              <span className="font-bold text-red-500">{countdown}</span>{' '}
              seconds due to inactivity.
            </p>
            <div className="flex gap-3">
              <button onClick={stayLoggedIn}
                      className="flex-1 py-2.5 rounded-lg bg-blue-600
                                 hover:bg-blue-700 text-white font-medium
                                 text-sm transition-colors">
                Stay logged in
              </button>
              <button onClick={logout}
                      className="flex-1 py-2.5 rounded-lg border border-gray-200
                                 dark:border-gray-600 text-gray-600
                                 dark:text-gray-400 hover:bg-gray-50
                                 dark:hover:bg-gray-700 font-medium text-sm">
                Log out now
              </button>
            </div>
          </div>
        </div>
      )}
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
