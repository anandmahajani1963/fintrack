// ============================================================
// fintrack — Export page
// File: src/pages/Export.jsx
// Version: 1.0 — 2026-04-16
// ============================================================

import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card, SectionTitle } from '../components/ui'
import { FileSpreadsheet, FileText, Download, CheckCircle } from 'lucide-react'

export default function Export({ year }) {
  const { password }          = useAuth()
  const [loading, setLoading] = useState(null)  // 'excel' | 'pdf' | null
  const [done, setDone]       = useState(null)
  const [error, setError]     = useState('')

  async function handleExport(format) {
    setLoading(format); setError(''); setDone(null)
    try {
      // Get fresh token via refresh
      const rt = sessionStorage.getItem('refresh_token')
      const ref = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      })
      const { access_token } = await ref.json()

      const url = `/api/v1/export/${format}?year=${year}`
      const r   = await fetch(url, {
        headers: {
          'Authorization':       `Bearer ${access_token}`,
          'X-Fintrack-Password': password,
        }
      })

      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: r.statusText }))
        throw new Error(err.detail || `Export failed (${r.status})`)
      }

      // Trigger browser download
      const blob     = await r.blob()
      const blobUrl  = URL.createObjectURL(blob)
      const filename = `fintrack_${year}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      const a        = document.createElement('a')
      a.href         = blobUrl
      a.download     = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      setDone(format)
    } catch (err) {
      setError(err.message)
    }
    setLoading(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Export</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Download your financial data — {year}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Excel */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30
                            flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet size={24} className="text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 dark:text-white text-lg">
                Excel Workbook
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                4 sheets — Summary, Monthly Pivot, Transactions, Categories.
                Open in Excel, Google Sheets, or LibreOffice.
              </p>
              <div className="space-y-1 mb-5">
                {[
                  'Summary KPIs with grand total',
                  'Monthly pivot table by category',
                  'Full transaction list (decrypted)',
                  'Category breakdown with averages',
                ].map(item => (
                  <p key={item} className="text-xs text-gray-500 dark:text-gray-400
                                           flex items-center gap-1.5">
                    <span className="text-green-500">✓</span> {item}
                  </p>
                ))}
              </div>
              <button
                onClick={() => handleExport('excel')}
                disabled={loading === 'excel'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                           bg-green-600 hover:bg-green-700 disabled:opacity-50
                           text-white font-medium text-sm transition-colors"
              >
                {loading === 'excel'
                  ? <><span className="w-4 h-4 border-2 border-white/30
                                        border-t-white rounded-full animate-spin" />
                     Generating…</>
                  : <><Download size={15} /> Download Excel</>
                }
              </button>
              {done === 'excel' && (
                <p className="text-xs text-green-600 dark:text-green-400
                               flex items-center gap-1 mt-2">
                  <CheckCircle size={13} /> Downloaded successfully
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* PDF */}
        <Card>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30
                            flex items-center justify-center flex-shrink-0">
              <FileText size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 dark:text-white text-lg">
                PDF Report
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray:400 mt-1 mb-4">
                Formatted landscape report, ready to print or share.
              </p>
              <div className="space-y-1 mb-5">
                {[
                  'Financial summary with KPIs',
                  'Category totals with percentages',
                  'Monthly pivot (top 15 categories)',
                  'Recent 50 transactions',
                ].map(item => (
                  <p key={item} className="text-xs text-gray-500 dark:text-gray-400
                                           flex items-center gap-1.5">
                    <span className="text-red-500">✓</span> {item}
                  </p>
                ))}
              </div>
              <button
                onClick={() => handleExport('pdf')}
                disabled={loading === 'pdf'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                           bg-red-600 hover:bg-red-700 disabled:opacity-50
                           text-white font-medium text-sm transition-colors"
              >
                {loading === 'pdf'
                  ? <><span className="w-4 h-4 border-2 border-white/30
                                        border-t-white rounded-full animate-spin" />
                     Generating…</>
                  : <><Download size={15} /> Download PDF</>
                }
              </button>
              {done === 'pdf' && (
                <p className="text-xs text-red-600 dark:text-red-400
                               flex items-center gap-1 mt-2">
                  <CheckCircle size={13} /> Downloaded successfully
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border
                        border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Info */}
      <Card>
        <SectionTitle>What's included</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm
                        text-gray-600 dark:text-gray-400">
          <div>
            <p className="font-medium text-gray-900 dark:text-white mb-1">
              Data scope
            </p>
            <p>All transactions for {year}. Transaction descriptions
               are decrypted using your password before export.</p>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white mb-1">
              Security note
            </p>
            <p>Downloaded files contain plaintext descriptions.
               Store them securely and do not share them unencrypted.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
