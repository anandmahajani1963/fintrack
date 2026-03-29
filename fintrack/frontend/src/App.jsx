// ============================================================
// fintrack — App root component
// File: src/App.jsx
// Version: 1.1 — 2026-03-27
// Changes: Added Import, Members, Reconciliation pages
// ============================================================

import React, { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login          from './pages/Login'
import Sidebar        from './components/Sidebar'
import Dashboard      from './pages/Dashboard'
import Categories     from './pages/Categories'
import Monthly        from './pages/Monthly'
import Transactions   from './pages/Transactions'
import Utilities      from './pages/Utilities'
import Members        from './pages/Members'
import Reconciliation from './pages/Reconciliation'
import Import         from './pages/Import'

const PAGES = {
  dashboard:      Dashboard,
  categories:     Categories,
  monthly:        Monthly,
  transactions:   Transactions,
  utilities:      Utilities,
  members:        Members,
  reconciliation: Reconciliation,
  import:         Import,
}

function AppInner() {
  const { isLoggedIn }  = useAuth()
  const [page, setPage] = useState('dashboard')
//  const [year, setYear] = useState(new Date().getFullYear())
  const [year, setYear] = useState(2025)

  if (!isLoggedIn) return <Login />

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
