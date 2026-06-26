// ============================================================
// fintrack — Categories page
// File: src/pages/Categories.jsx
// Version: 1.0 — 2026-03-26
// ============================================================

import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts'
import { analytics }  from '../api/client'
import { Card, Loading, ErrorMsg, SectionTitle, Badge, fmt, fmtDec } from '../components/ui'

export default function Categories({ year }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null); setError('')
    analytics.categorySummary(year)
      .then(setData)
      .catch(e => setError(e.message))
  }, [year])

  if (error) return <ErrorMsg message={error} />
  if (!data)  return <Loading />

  // Group by parent category for chart
  const byCategory = {}
  for (const c of data.categories) {
    if (!byCategory[c.category]) {
      byCategory[c.category] = { category: c.category, total: 0,
                                  is_essential: c.is_essential,
                                  color: c.color_code || '#6b7280' }
    }
    byCategory[c.category].total += c.total
  }
  const chartData = Object.values(byCategory)
    .sort((a, b) => b.total - a.total)
    .filter(c => c.category !== 'Other' || c.total > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Categories</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Spending breakdown — {year}
        </p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        <div className="bg-white dark:bg-gray-800 border border-gray-200
                        dark:border-gray-700 rounded-xl px-4 py-2.5">
          <p className="text-xs text-gray-500">Grand Total</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {fmtDec(data.grand_total)}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200
                        dark:border-green-800 rounded-xl px-4 py-2.5">
          <p className="text-xs text-green-600 dark:text-green-400">Essential</p>
          <p className="text-lg font-bold text-green-700 dark:text-green-400">
            {fmtDec(data.essential_total)}
            <span className="text-xs font-normal ml-1">({data.essential_pct}%)</span>
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200
                        dark:border-blue-800 rounded-xl px-4 py-2.5">
          <p className="text-xs text-blue-600 dark:text-blue-400">Non-Essential</p>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
            {fmtDec(data.nonessential_total)}
            <span className="text-xs font-normal ml-1">({data.nonessential_pct}%)</span>
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <Card>
        <SectionTitle>Spend by Category</SectionTitle>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} layout="vertical"
                    margin={{ left: 10, right: 60, top: 0, bottom: 0 }}>
            <XAxis type="number"
                   tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
                   tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="category"
                   width={110} tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => fmtDec(v)} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Detail table */}
      <Card>
        <SectionTitle>Category Detail</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {['Category', 'Subcategory', 'Type', 'Amount', '% of Total', 'Txns'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium
                                         text-gray-500 dark:text-gray-400 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.categories.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: c.color_code || '#6b7280' }} />
                      {c.category}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-gray-500 dark:text-gray-400">
                    {c.subcategory !== c.category ? c.subcategory : '—'}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge color={c.is_essential ? 'green' : 'blue'}>
                      {c.is_essential ? 'Essential' : 'Discretionary'}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white">
                    {fmtDec(c.total)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-500">
                    {c.pct}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-500">
                    {c.txn_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
