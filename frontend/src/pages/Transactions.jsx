// ============================================================
// fintrack — Transactions page
// File: src/pages/Transactions.jsx
// Version: 1.0 — 2026-03-26
// ============================================================

import React, { useEffect, useState, useCallback } from 'react'
import { transactions } from '../api/client'
import { useAuth }      from '../context/AuthContext'
import { Card, Loading, ErrorMsg, Badge, fmtDec } from '../components/ui'
import { Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

const CATEGORIES = [
  'All','Air Travel','Car Rental','Dining','Education','Entertainment',
  'Fees & Interest','Groceries','Health','Home Improvement','Hotel',
  'Insurance','Membership','Other','Personal Care','Pet Care',
  'Shopping','Transport','Utilities'
]

export default function Transactions({ year }) {
  const { password }    = useAuth()
  const [data, setData] = useState(null)
  const [error, setError]     = useState('')
  const [page, setPage]       = useState(1)
  const [category, setCategory] = useState('All')
  const [search, setSearch]   = useState('')
  const [searchInput, setSearchInput] = useState('')

  const load = useCallback(() => {
    setData(null); setError('')
    const params = { year, page, page_size: 50 }
    if (category !== 'All') params.category = category
    transactions.list(password, params)
      .then(setData)
      .catch(e => setError(e.message))
  }, [password, year, page, category])

  useEffect(() => { load() }, [load])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [year, category])

  // Client-side search filter on loaded page
  const items = data?.items?.filter(t =>
    !search || t.description.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {data ? `${data.total} transactions — ${year}` : `Loading — ${year}`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Search descriptions…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border
                       border-gray-200 dark:border-gray-600
                       bg-white dark:bg-gray-800
                       text-gray-900 dark:text-white outline-none
                       focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="text-sm rounded-lg border border-gray-200 dark:border-gray-600
                     bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                     px-3 py-2 outline-none"
        >
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {error && <ErrorMsg message={error} />}

      <Card className="p-0 overflow-hidden">
        {!data ? <div className="p-6"><Loading /></div> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    {['Date','Description','Category','Amount','Card'].map(h => (
                      <th key={h} className="text-left py-3 px-4 text-xs font-medium
                                             text-gray-500 dark:text-gray-400 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400 text-sm">
                        No transactions found
                      </td>
                    </tr>
                  ) : items.map(t => (
                    <tr key={t.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="py-2.5 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="py-2.5 px-4 text-gray-900 dark:text-white max-w-xs">
                        <div className="flex items-center gap-2">
                          {t.is_large && (
                            <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />
                          )}
                          <span className="truncate">{t.description}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge color={t.is_essential ? 'green' : 'blue'}>
                          {t.category}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold
                                     text-gray-900 dark:text-white whitespace-nowrap">
                        {fmtDec(t.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-gray-500 dark:text-gray-400 capitalize">
                        {t.source_file?.split('_')[0] || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3
                              border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500">
                  Page {data.page} of {data.pages} ({data.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                               disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                    disabled={page === data.pages}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                               disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
