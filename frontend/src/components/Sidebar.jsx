// ============================================================
// fintrack — Sidebar navigation
// File: src/components/Sidebar.jsx
// Version: 1.3 — 2026-07-10
// Changes:
//   v1.2  2026-04-05  Added Members, Reconciliation, Import nav items
//   v1.3  2026-07-10  Mobile responsive: slide-out overlay with backdrop
// ============================================================

import React from 'react'
import {
  LayoutDashboard, PieChart, CalendarDays,
  List, LogOut, TrendingUp, Users,
  ClipboardCheck, Upload, DollarSign, Download, Zap, BookOpen, X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { id: 'dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'categories',     label: 'Categories',     icon: PieChart        },
  { id: 'monthly',        label: 'Monthly',        icon: CalendarDays    },
  { id: 'transactions',   label: 'Transactions',   icon: List            },
  { id: 'utilities',      label: 'Utilities',      icon: Zap             },
  { id: 'members',        label: 'Members',        icon: Users           },
  { id: 'budgets',        label: 'Budgets',        icon: DollarSign      },
  { id: 'reconciliation', label: 'Reconciliation', icon: ClipboardCheck  },
  { id: 'import',         label: 'Import Data',    icon: Upload          },
  { id: 'export',         label: 'Export',          icon: Download        },
  { id: 'upgrade',        label: 'Upgrade Plan',   icon: Zap             },
]

export default function Sidebar({ active, onNavigate, isOpen, onClose }) {
  const { user, logout, plan } = useAuth()

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-5 py-5 border-b
                      border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <TrendingUp size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 dark:text-white text-lg">fintrack</span>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-100
                     dark:hover:bg-gray-800 text-gray-400"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <div className="px-4 pt-4">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase mb-1">
          Year
        </p>
        <select
          className="w-full text-sm rounded-lg border border-gray-200
                     dark:border-gray-600 bg-gray-50 dark:bg-gray-800
                     text-gray-700 dark:text-gray-300 px-3 py-1.5 outline-none"
          defaultValue={2026}
          onChange={e => onNavigate(active, parseInt(e.target.value))}
        >
          {[2026, 2025, 2024, 2023].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                          text-sm font-medium transition-colors text-left
                          ${isActive
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
            >
              <Icon size={17} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="px-3 pb-2">
        <a href="/guide.html" target="_blank" rel="noopener noreferrer"
           className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                      text-sm font-medium text-gray-600 dark:text-gray-400
                      hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <BookOpen size={17} />
          User Guide
        </a>
      </div>

      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {user?.email}
        </p>
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2 mt-1
          ${plan === 'premium'  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
            plan === 'household' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
          {plan === 'premium' ? '⭐ Premium' : plan === 'household' ? '🏠 Household' : '🆓 Free'}
        </span>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-gray-500
                     dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400
                     transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
        <a href="/delete.html" target="_blank" rel="noopener noreferrer"
           className="flex items-center gap-2 text-xs text-gray-400
                      dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400
                      transition-colors mt-2">
          Delete account
        </a>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col
                        bg-white dark:bg-gray-900
                        border-r border-gray-200 dark:border-gray-700
                        h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile sidebar — slide-out overlay */}
      <aside className={`fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col
                         bg-white dark:bg-gray-900
                         border-r border-gray-200 dark:border-gray-700
                         transform transition-transform duration-200 ease-in-out
                         md:hidden
                         ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </aside>
    </>
  )
}
