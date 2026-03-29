// ============================================================
// fintrack — Members summary page
// File: src/pages/Members.jsx
// Version: 1.0 — 2026-03-27
// Purpose: Spend by cardholder x category (mirrors Excel Member Summary sheet)
// ============================================================

import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip,
         ResponsiveContainer, Legend } from 'recharts'
import { useAuth }    from '../context/AuthContext'
import { transactions } from '../api/client'
import { Card, Loading, ErrorMsg, SectionTitle, fmt, fmtDec } from '../components/ui'

export default function Members({ year }) {
  const { password }        = useAuth()
  const [accounts, setAccounts] = useState(null)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!password) return
    setAccounts(null); setError('')
    transactions.accounts(password)
      .then(setAccounts)
      .catch(e => setError(e.message))
  }, [password])

  if (error)    return <ErrorMsg message={error} />
  if (!accounts) return <Loading />

  // Group accounts by member
  const byMember = {}
  for (const acc of accounts) {
    const key = acc.member || 'Shared'
    if (!byMember[key]) byMember[key] = []
    byMember[key].push(acc)
  }

  const members = Object.entries(byMember)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Members</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Card accounts by cardholder
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {members.map(([member, accs]) => (
          <Card key={member}>
            <SectionTitle>{member}</SectionTitle>
            <div className="space-y-2">
              {accs.map(acc => (
                <div key={acc.id}
                     className="flex justify-between items-center py-2.5 px-3
                                rounded-lg bg-gray-50 dark:bg-gray-700/30 text-sm">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white capitalize">
                      {acc.provider}
                    </p>
                    <p className="text-xs text-gray-400">{acc.label}</p>
                  </div>
                  <span className="text-xs text-gray-500 capitalize">{acc.source}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle>Note</SectionTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Per-member spending totals will appear here once the analytics endpoint
          is extended. Currently showing card account breakdown by cardholder.
          Full member × category pivot is available in the Monthly view.
        </p>
      </Card>
    </div>
  )
}
