// ============================================================
// fintrack — Monthly pivot page
// File: src/pages/Monthly.jsx
// Version: 1.1 — 2026-03-27
// Changes: Fixed to use separate API calls (no password needed for pivot)
// ============================================================

import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip,
         ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { analytics } from '../api/client'
import { Card, Loading, ErrorMsg, SectionTitle, fmt, fmtDec } from '../components/ui'

export default function Monthly({ year }) {
  const [data, setData]   = useState(null)
  const [split, setSplit] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setData(null); setSplit(null); setError('')
    analytics.monthlyPivot(year).then(setData).catch(e => setError(e.message))
    analytics.essentialSplit(year).then(setSplit).catch(e => setError(e.message))
  }, [year])

  if (error) return <ErrorMsg message={error} />
  if (!data || !split) return <Loading />

  const months = data.months

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monthly</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Spend by month and category — {year}
        </p>
      </div>

      <Card>
        <SectionTitle>Essential vs Discretionary by Month</SectionTitle>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={split.months} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.3)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }}
                   tickFormatter={m => m.split(' ')[0]} />
            <YAxis tick={{ fontSize: 11 }}
                   tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={45} />
            <Tooltip formatter={v => fmtDec(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="essential"    name="Essential"    fill="#16a34a" stackId="a" />
            <Bar dataKey="nonessential" name="Discretionary" fill="#2563eb" stackId="a"
                 radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <SectionTitle>Category × Month Pivot</SectionTitle>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 font-medium text-gray-500
                               dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-800
                               z-10 min-w-[160px]">
                  Category / Subcategory
                </th>
                {months.map(m => (
                  <th key={m} className="text-right py-2 px-3 font-medium
                                          text-gray-500 dark:text-gray-400 min-w-[80px]">
                    {m.split(' ')[0]}
                  </th>
                ))}
                <th className="text-right py-2 px-3 font-medium
                                text-gray-900 dark:text-white min-w-[90px]">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {data.rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-2 px-3 sticky left-0 bg-white dark:bg-gray-800 z-10">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: row.color_code || '#6b7280' }} />
                      <span className="text-gray-900 dark:text-white font-medium">{row.category}</span>
                      {row.subcategory !== row.category &&
                        <span className="text-gray-400"> / {row.subcategory}</span>}
                    </div>
                  </td>
                  {months.map(m => {
                    const val = row.months[m] || 0
                    return (
                      <td key={m} className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                        {val > 0 ? fmt(val) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                    )
                  })}
                  <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">
                    {fmt(row.row_total)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 dark:bg-gray-700/40 font-bold border-t-2
                             border-gray-300 dark:border-gray-600">
                <td className="py-2.5 px-3 sticky left-0 bg-gray-50 dark:bg-gray-700/40
                                text-gray-900 dark:text-white">TOTAL</td>
                {months.map(m => (
                  <td key={m} className="py-2.5 px-3 text-right text-gray-900 dark:text-white">
                    {fmt(data.col_totals[m] || 0)}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">
                  {fmt(data.grand_total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
