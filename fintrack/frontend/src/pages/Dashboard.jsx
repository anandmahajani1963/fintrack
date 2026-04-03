import React, { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import { useAuth }   from '../context/AuthContext'
import { analytics } from '../api/client'
import { Card, StatCard, Loading, ErrorMsg, SectionTitle,
         fmt, fmtDec } from '../components/ui'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function Dashboard({ year }) {
  const { password }      = useAuth()
  const [catData, setCat] = useState(null)
  const [trend, setTrend] = useState(null)
  const [large, setLarge] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!password) return
    setCat(null); setTrend(null); setLarge(null); setError('')
    analytics.categorySummary(year).then(setCat).catch(e => setError(e.message))
    analytics.trend(year).then(setTrend).catch(e => setError(e.message))
    analytics.largeExpenses(password, year, 500)
      .then(setLarge).catch(() => setLarge({ count: 0, items: [] }))
  }, [year, password])

  if (error) return <ErrorMsg message={error} />
  if (!catData || !trend) return <Loading />

  const months   = trend.months
  const last     = months[months.length - 1]
  const momDelta = last?.mom_delta || 0
  const MomIcon  = momDelta > 0 ? TrendingUp : momDelta < 0 ? TrendingDown : Minus
  const momColor = momDelta > 0 ? "text-red-500" : "text-green-500"
  const topCats  = catData.categories.filter(c => c.category !== "Other").slice(0, 6)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Financial overview — {year}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Spend" value={fmt(catData.grand_total)}
                  sub={`${catData.categories.length} categories`} color="blue" />
        <StatCard label="Essential" value={fmt(catData.essential_total)}
                  sub={`${catData.essential_pct}% of total`} color="green" />
        <StatCard label="Discretionary" value={fmt(catData.nonessential_total)}
                  sub={`${catData.nonessential_pct}% of total`} color="amber" />
        <StatCard label={last?.month || "Last month"} value={fmt(last?.total || 0)}
                  sub={<span className={`flex items-center gap-1 ${momColor}`}><MomIcon size={12} />{momDelta >= 0 ? "+" : ""}{fmt(momDelta)} vs prior</span>}
                  color={momDelta > 0 ? "red" : "green"} />
      </div>
      <Card>
        <div className="font-semibold text-gray-900 dark:text-white mb-4">Monthly Spending — {year}</div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={months} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
            <defs>
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.25)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={m => m.split(" ")[0]} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={48} />
            <Tooltip formatter={v => [fmtDec(v), "Spend"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5}
                  fill="url(#spendGradient)" dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <div className="font-semibold text-gray-900 dark:text-white mb-4">Top Categories</div>
          <div className="space-y-3">
            {topCats.map(cat => (
              <div key={`${cat.category}-${cat.subcategory}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">{cat.category}{cat.category !== cat.subcategory && <span className="text-gray-400 font-normal"> / {cat.subcategory}</span>}</span>
                  <span className="text-gray-900 dark:text-white font-semibold">{fmt(cat.total)}<span className="text-gray-400 font-normal ml-1">({cat.pct}%)</span></span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(cat.pct * 2, 100)}%`, background: cat.color_code || "#3b82f6" }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="font-semibold text-gray-900 dark:text-white mb-4">Large Expenses (&gt;$500)</div>
          {!large || large.count === 0 ? <p className="text-sm text-gray-400">No large expenses this year</p>
            : <div className="space-y-2">{large.items.slice(0, 6).map(t => (
                <div key={t.id} className="flex justify-between items-center text-sm">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-gray-900 dark:text-white truncate">{t.description}</p>
                    <p className="text-xs text-gray-400">{t.date} · {t.category}</p>
                  </div>
                  <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{fmtDec(t.amount)}</span>
                </div>
              ))}{large.count > 6 && <p className="text-xs text-gray-400 pt-1">+{large.count - 6} more</p>}
            </div>}
        </Card>
      </div>
    </div>
  )
}
