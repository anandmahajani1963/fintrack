// ============================================================
// fintrack — Members page
// File: src/pages/Members.jsx
// Version: 1.1 — 2026-03-31
// Changes:
//   v1.0  2026-03-27  Initial — account list only
//   v1.1  2026-03-31  Added real per-member spend analytics
// ============================================================

import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip,
         ResponsiveContainer, Legend, Cell } from 'recharts'
import { analytics, transactions } from '../api/client'
import { useAuth }  from '../context/AuthContext'
import { Card, Loading, ErrorMsg, SectionTitle, Badge, fmt, fmtDec } from '../components/ui'

const MEMBER_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#dc2626']

export default function Members({ year }) {
  const { password }          = useAuth()
  const [data, setData]       = useState(null)
  const [accounts, setAccounts] = useState(null)
  const [error, setError]     = useState('')

  useEffect(() => {
    setData(null); setAccounts(null); setError('')

    analytics.members(year)
      .then(setData)
      .catch(e => setError(e.message))

    if (password) {
      transactions.accounts(password)
        .then(setAccounts)
        .catch(() => setAccounts([]))
    }
  }, [year, password])

  if (error)  return <ErrorMsg message={error} />
  if (!data)  return <Loading />

  const members = data.members

  // Build chart data — top categories per member side by side
  const topCats = [...new Set(
    members.flatMap(m => m.categories.slice(0, 5).map(c => c.category))
  )].slice(0, 8)

  const chartData = topCats.map(cat => {
    const row = { category: cat }
    members.forEach((m, i) => {
      const found = m.categories.find(c => c.category === cat)
      row[`Member ${m.member_index}`] = found ? found.total : 0
    })
    return row
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Members</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Spend by cardholder — {year} · Total: {fmtDec(data.total)}
        </p>
      </div>

      {/* Member summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {members.map((member, i) => {
          const color = MEMBER_COLORS[i % MEMBER_COLORS.length]
          const memberAccounts = accounts?.filter(
            a => a.provider === member.provider
          ) || []

          return (
            <Card key={i}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center
                                  text-white font-bold text-sm"
                       style={{ background: color }}>
                    {member.member_index}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">
                      {member.provider} cardholder
                    </p>
                    {memberAccounts.length > 0 && (
                      <p className="text-xs text-gray-400">
                        {memberAccounts.map(a => a.label).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {fmtDec(member.total)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {Math.round(member.total * 100 / data.total)}% of total
                  </p>
                </div>
              </div>

              {/* Top categories for this member */}
              <div className="space-y-2">
                {member.categories.slice(0, 8).map((cat, j) => (
                  <div key={j} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: cat.color_code || '#6b7280' }} />
                      <span className="text-gray-700 dark:text-gray-300 truncate">
                        {cat.category}
                        {cat.subcategory !== cat.category &&
                          <span className="text-gray-400"> / {cat.subcategory}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <Badge color={cat.is_essential ? 'green' : 'blue'}>
                        {cat.is_essential ? 'Ess' : 'Disc'}
                      </Badge>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {fmtDec(cat.total)}
                      </span>
                    </div>
                  </div>
                ))}
                {member.categories.length > 8 && (
                  <p className="text-xs text-gray-400 pt-1">
                    +{member.categories.length - 8} more categories
                  </p>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Comparison chart */}
      {members.length > 1 && chartData.length > 0 && (
        <Card>
          <SectionTitle>Category Comparison by Member</SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical"
                      margin={{ left: 15, right: 20, top: 5, bottom: 5 }}>
              <XAxis type="number"
                     tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
                     tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="category"
                     width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => fmtDec(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {members.map((m, i) => (
                <Bar key={i}
                     dataKey={`Member ${m.member_index}`}
                     fill={MEMBER_COLORS[i % MEMBER_COLORS.length]}
                     radius={[0, 3, 3, 0]}
                     maxBarSize={18} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
