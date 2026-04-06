// ============================================================
// fintrack — App root component
// File: src/App.jsx
// Version: 1.3 — 2026-04-05
// Changes:
//   v1.0  2026-03-26  Initial implementation
//   v1.1  2026-03-27  Added Import, Members, Reconciliation pages
//   v1.2  2026-03-31  Added PasswordPrompt for post-refresh session restore
//   v1.3  2026-04-05  Added Budgets page
// ============================================================

import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login          from './pages/Login'
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
  const { isLoggedIn, needsPassword } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [year, setYear] = useState(2025)

  // Not logged in → show login page
  if (!isLoggedIn) return <Login />

  // Session restored but password needed → show password prompt
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
