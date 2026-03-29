// ============================================================
// fintrack — Reconciliation page
// File: src/pages/Reconciliation.jsx
// Version: 1.0 — 2026-03-27
// Purpose: Show uncategorised transactions + category totals
//          to help reduce "Other" percentage
// ============================================================

import React, { useEffect, useState } from 'react'
import { useAuth }    from '../context/AuthContext'
import { analytics, transactions } from '../api/client'
import { Card, Loading, ErrorMsg, SectionTitle, Badge, fmtDec } from '../components/ui'
import { AlertCircle, CheckCircle } from 'lucide-react'

export default function Reconciliation({ year }) {
  const { password }    = useAuth()
  const [catData, setCat]   = useState(null)
  const [others, setOthers] = useState(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (!password) return
    setCat(null); setOthers(null); setError('')

    analytics.categorySummary(year)
      .then(setCat)
      .catch(e => setError(e.message))

    transactions.list(password, { year, category: 'Other', page_size: 200 })
      .then(d => setOthers(d.items))
      .catch(e => setError(e.message))
  }, [year, password])

  if (error)              return <ErrorMsg message={error} />
  if (!catData || !others) return <Loading />

  const otherCat  = catData.categories.find(c => c.category === 'Other')
  const otherPct  = otherCat?.pct || 0
  const otherTotal= otherCat?.total || 0
  const sortedOthers = [...others].sort((a, b) => b.amount - a.amount)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reconciliation</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Review uncategorised transactions — {year}
        </p>
      </div>

      {/* Other summary */}
      <div className={`rounded-2xl border p-5 flex items-center gap-4
                       ${otherPct < 5
                         ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                         : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                       }`}>
        {otherPct < 5
          ? <CheckCircle size={28} className="text-green-600 dark:text-green-400 flex-shrink-0" />
          : <AlertCircle size={28} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
        }
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            {otherPct < 5 ? 'Good categorization!' : 'Uncategorised transactions need attention'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {others.length} transactions totalling {fmtDec(otherTotal)} ({otherPct}% of total spend)
            are in the "Other" category.
            {otherPct >= 5 && ' Use Jupyter notebook 03 to add keywords and reduce this.'}
          </p>
        </div>
      </div>

      {/* Uncategorised transactions */}
      <Card>
        <SectionTitle>
          Uncategorised Transactions ({others.length})
        </SectionTitle>
        {others.length === 0 ? (
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ All transactions are categorised
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {['Date','Description','Amount','Card'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium
                                           text-gray-500 dark:text-gray-400 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedOthers.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{t.date}</td>
                    <td className="py-2.5 px-3 text-gray-900 dark:text-white max-w-sm truncate">
                      {t.description}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold
                                   text-gray-900 dark:text-white whitespace-nowrap">
                      {fmtDec(t.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 capitalize">
                      {t.source_file?.split('_')[0] || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* All category totals for cross-check */}
      <Card>
        <SectionTitle>Category Totals (Cross-check)</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr>
                {['Category','Subcategory','Total','%','Txns','Type'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium
                                         text-gray-500 dark:text-gray-400 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {catData.categories.map((c, i) => (
                <tr key={i}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/30
                                ${c.category === 'Other' ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                  <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full"
                            style={{ background: c.color_code || '#6b7280' }} />
                      {c.category}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-gray-500">
                    {c.subcategory !== c.category ? c.subcategory : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white">
                    {fmtDec(c.total)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-500">{c.pct}%</td>
                  <td className="py-2.5 px-3 text-right text-gray-500">{c.txn_count}</td>
                  <td className="py-2.5 px-3">
                    <Badge color={c.is_essential ? 'green' : 'blue'}>
                      {c.is_essential ? 'Essential' : 'Discretionary'}
                    </Badge>
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
