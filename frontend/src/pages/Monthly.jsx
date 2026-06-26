import React, { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  ResponsiveContainer, Legend, CartesianGrid
} from 'recharts'
import { analytics } from '../api/client'
import { Card, Loading, ErrorMsg, SectionTitle, fmt, fmtDec } from '../components/ui'

// Custom bar shape that draws the bar AND a % label in the center
function LabeledBar(props) {
  const { x, y, width, height, fill, value, total } = props
  if (!value || !height || height < 16) return <rect x={x} y={y} width={width} height={height} fill={fill} />
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
      {pct >= 5 && (
        <text x={x + width / 2} y={y + height / 2}
              textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={11} fontWeight="600">
          {pct}%
        </text>
      )}
    </g>
  )
}

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
  // Pre-compute totals so each bar knows its month total
  const chartData = split.months.map(m => ({
    ...m,
    total: m.essential + m.nonessential,
  }))

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
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.3)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }}
                   tickFormatter={m => m.split(' ')[0]} />
            <YAxis tick={{ fontSize: 11 }}
                   tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={45} />
            <Tooltip formatter={(value, name) => [fmtDec(value), name]}
                     contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="essential" name="Essential" stackId="a"
                 shape={(props) => <LabeledBar {...props} fill="#16a34a"
                   total={(chartData[props.index] || {}).total || 0} />} />
            <Bar dataKey="nonessential" name="Discretionary" stackId="a"
                 radius={[3,3,0,0]}
                 shape={(props) => <LabeledBar {...props} fill="#2563eb"
                   total={(chartData[props.index] || {}).total || 0} />} />
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
                               z-10 min-w-[160px]">Category / Subcategory</th>
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
                      <span className="text-gray-900 dark:text-white font-medium">
                        {row.category}
                      </span>
                      {row.subcategory !== row.category &&
                        <span className="text-gray-400"> / {row.subcategory}</span>}
                    </div>
                  </td>
                  {months.map(m => {
                    const val = row.months[m] || 0
                    return (
                      <td key={m} className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                        {val > 0 ? fmt(val)
                          : <span className="text-gray-300 dark:text-gray-600">—</span>}
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
