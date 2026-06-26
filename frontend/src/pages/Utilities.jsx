// ============================================================
// fintrack — Utilities seasonal page
// File: src/pages/Utilities.jsx
// Version: 1.0 — 2026-03-26
// ============================================================

import React, { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid
} from 'recharts'
import { analytics }  from '../api/client'
import { Card, Loading, ErrorMsg, SectionTitle, Badge, fmtDec } from '../components/ui'
import { TrendingUp } from 'lucide-react'

const UTIL_COLORS = {
  'Electric':          '#2563eb',
  'Water & Sewer':     '#0891b2',
  'Gas & Heating':     '#ea580c',
  'Internet & Cable':  '#7c3aed',
  'Waste & Sanitation':'#16a34a',
  'Home Security':     '#dc2626',
  'Car Wash':          '#0369a1',
  'Other Utility':     '#6b7280',
}

export default function Utilities({ year }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null); setError('')
    analytics.utilitySeasonal(year)
      .then(setData)
      .catch(e => setError(e.message))
  }, [year])

  if (error) return <ErrorMsg message={error} />
  if (!data)  return <Loading />

  if (data.utility_types.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        No utility data for {year}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Utilities</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Seasonal breakdown — {year} · Total: {fmtDec(data.total_utility_spend)}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {data.utility_types.map(ut => {
          const color = UTIL_COLORS[ut.utility_type] || '#6b7280'
          const aboveMonths = ut.months.filter(m => m.above_average).length

          return (
            <Card key={ut.utility_type}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                    {ut.utility_type}
                  </h3>
                  {ut.seasonal_note && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {ut.seasonal_note}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Monthly avg</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {fmtDec(ut.yearly_avg)}
                  </p>
                </div>
              </div>

              {aboveMonths > 0 && (
                <div className="flex items-center gap-1.5 mb-3">
                  <TrendingUp size={13} className="text-amber-500" />
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {aboveMonths} month{aboveMonths > 1 ? 's' : ''} above average
                  </span>
                </div>
              )}

              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={ut.months} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }}
                         tickFormatter={m => m.split(' ')[0]} />
                  <YAxis tick={{ fontSize: 10 }}
                         tickFormatter={v => `$${v}`} width={40} />
                  <Tooltip formatter={v => fmtDec(v)} />
                  <ReferenceLine y={ut.yearly_avg} stroke={color}
                                 strokeDasharray="4 2" strokeOpacity={0.5} />
                  <Line type="monotone" dataKey="amount" stroke={color}
                        strokeWidth={2} dot={{ r: 3, fill: color }}
                        activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>

              {/* Month breakdown */}
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                {ut.months.map(m => (
                  <div key={m.month}
                       className="flex justify-between items-center text-xs py-0.5">
                    <span className="text-gray-500 dark:text-gray-400">
                      {m.month}
                    </span>
                    <span className={`font-medium ${
                      m.above_average
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {fmtDec(m.amount)}
                      {m.above_average && ' ▲'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
