// ============================================================
// fintrack — Sidebar navigation
// File: src/components/Sidebar.jsx
// Version: 1.2 — 2026-04-05
// Changes: Added Members, Reconciliation, Import nav items
// ============================================================

import React from 'react'
import {
  LayoutDashboard, PieChart, CalendarDays,
  List, Zap, LogOut, TrendingUp, Users,
  ClipboardCheck, Upload, DollarSign, Download
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
  { id: 'export',         label: 'Export',         icon: Download        },
]

export default function Sidebar({ active, onNavigate }) {
  const { user, logout } = useAuth()

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col
                      bg-white dark:bg-gray-900
                      border-r border-gray-200 dark:border-gray-700
                      h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b
                      border-gray-200 dark:border-gray-700">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <TrendingUp size={16} className="text-white" />
        </div>
        <span className="font-bold text-gray-900 dark:text-white text-lg">fintrack</span>
      </div>

      <div className="px-4 pt-4">
        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase mb-1">
          Year
        </p>
        <select
          className="w-full text-sm rounded-lg border border-gray-200
                     dark:border-gray-600 bg-gray-50 dark:bg-gray-800
                     text-gray-700 dark:text-gray-300 px-3 py-1.5 outline-none"
          defaultValue={new Date().getFullYear()}
          onChange={e => onNavigate(active, parseInt(e.target.value))}
        >
          {[2025, 2024, 2023].map(y => (
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

      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
          {user?.email}
        </p>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-gray-500
                     dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400
                     transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
