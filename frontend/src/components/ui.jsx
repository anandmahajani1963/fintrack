// ============================================================
// fintrack — Shared UI components
// File: src/components/ui.jsx
// Version: 1.0 — 2026-03-26
// ============================================================

import React from 'react'

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl
                     border border-gray-200 dark:border-gray-700
                     shadow-sm p-5 ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:  'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red:   'text-red-600 dark:text-red-400',
    gray:  'text-gray-600 dark:text-gray-400',
  }
  return (
    <Card>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </Card>
  )
}

export function Loading() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600
                      rounded-full animate-spin" />
    </div>
  )
}

export function ErrorMsg({ message }) {
  return (
    <div className="rounded-xl bg-red-50 dark:bg-red-900/20
                    border border-red-200 dark:border-red-800
                    text-red-700 dark:text-red-400 p-4 text-sm">
      {message}
    </div>
  )
}

export function SectionTitle({ children }) {
  return (
    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
      {children}
    </h2>
  )
}

export function Badge({ children, color = 'gray' }) {
  const colors = {
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    blue:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    red:   'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    gray:  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full
                      text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}

export function fmt(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(amount)
}

export function fmtDec(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2
  }).format(amount)
}
