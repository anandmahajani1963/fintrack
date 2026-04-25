// ============================================================
// fintrack — Import Data page
// File: src/pages/Import.jsx
// Version: 1.0 — 2026-03-27
// Purpose: Upload CSV files directly from the browser
// ============================================================

import React, { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { Card, SectionTitle, ErrorMsg } from '../components/ui'
import { Upload, CheckCircle, AlertCircle, FileText, X } from 'lucide-react'

//const API_BASE = import.meta.env.VITE_API_BASE || 'http://192.168.1.170:8000'
const API_BASE = ''
// CSV format options — covers all major US credit cards and banks
const FORMATS = [
  {
    value: 'debit_credit',
    label: 'Debit/Credit columns',
    desc:  'Citi, AmEx, Discover, Capital One',
    hint:  'Separate Debit and Credit columns',
    auto:  ['citi', 'amex', 'discover', 'capital'],
  },
  {
    value: 'amount_negative',
    label: 'Amount column (negative charges)',
    desc:  'Chase, Bank of America, Wells Fargo, checking accounts',
    hint:  'Single Amount column — purchases are negative',
    auto:  ['chase', 'boa', 'bofa', 'bank_of_america', 'wellsfargo', 'wf_'],
  },
  {
    value: 'amount_positive',
    label: 'Amount column (positive charges)',
    desc:  'Some regional banks and older exports',
    hint:  'Single Amount column — purchases are positive',
    auto:  [],
  },
]

export default function Import() {
  const { password } = useAuth()
  const [files, setFiles]     = useState([])   // [{file, provider, status, result}]
  const [importing, setImporting] = useState(false)
  const inputRef = useRef()

  function addFiles(fileList) {
    const newFiles = Array.from(fileList).map(file => {
      // Auto-detect format from filename
      const name = file.name.toLowerCase()
      const fmt = FORMATS.find(f => f.auto.some(a => name.includes(a)))
      return { file, provider: fmt?.value || '', providerName: '', status: 'pending', result: null, error: null }
    })
    setFiles(prev => [...prev, ...newFiles])
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  function updateProvider(idx, provider) {
    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, provider } : f))
  }
  function updateProviderName(idx, name) {
    setFiles(prev => prev.map((f, i) => i === idx ? { ...f, providerName: name } : f))
  }

  async function importAll() {
    if (!password) return
    setImporting(true)

    // Get fresh token via refresh
    const refreshR = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: sessionStorage.getItem('refresh_token') || '' })
    })
    const { access_token } = await refreshR.json()

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (f.status === 'success') continue
      if (!f.provider) {
        setFiles(prev => prev.map((x, j) => j === i
          ? { ...x, status: 'error', error: 'Select a CSV format' } : x))
        continue
      }

      setFiles(prev => prev.map((x, j) => j === i ? { ...x, status: 'importing' } : x))

      const formData = new FormData()
      formData.append('file', f.file)
      formData.append('provider', f.provider)
      formData.append('password', password)

      try {
        const r = await fetch(`${API_BASE}/api/v1/transactions/import`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${access_token}` },
          body: formData,
        })
        const result = await r.json()
        if (!r.ok) throw new Error(result.detail || 'Import failed')
        setFiles(prev => prev.map((x, j) => j === i
          ? { ...x, status: 'success', result } : x))
      } catch (err) {
        setFiles(prev => prev.map((x, j) => j === i
          ? { ...x, status: 'error', error: err.message } : x))
      }
    }
    setImporting(false)
  }

  const pendingCount = files.filter(f => f.status === 'pending').length
  const canImport    = pendingCount > 0 && files.every(f => f.provider)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import Data</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Upload credit card CSV files — Citi, AmEx, or Chase
        </p>
      </div>

      {/* Drop zone */}
      <Card>
        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600
                     rounded-xl p-10 text-center cursor-pointer
                     hover:border-blue-400 dark:hover:border-blue-500
                     hover:bg-blue-50 dark:hover:bg-blue-900/10
                     transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        >
          <Upload size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-700 dark:text-gray-300 font-medium">
            Drop CSV files here or click to browse
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Rename files to start with citi_, amex_, or chase_ for auto-detection
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".csv"
            className="hidden"
            onChange={e => addFiles(e.target.files)}
          />
        </div>
      </Card>

      {/* File list */}
      {files.length > 0 && (
        <Card>
          <SectionTitle>Files to Import</SectionTitle>
          <div className="space-y-3">
            {files.map((f, i) => (
              <div key={i}
                   className="flex items-center gap-3 p-3 rounded-xl
                              bg-gray-50 dark:bg-gray-700/30">
                <FileText size={18} className="text-gray-400 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {f.file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(f.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                {/* Provider selector */}
                {f.status === 'pending' && (
                  <select
                    value={f.provider}
                    onChange={e => updateProvider(i, e.target.value)}
                    className="text-sm rounded-lg border border-gray-200 dark:border-gray-600
                               bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                               px-2 py-1.5 outline-none"
                  >
                    <option value="">Select CSV format…</option>
                    {FORMATS.map(fmt => (
                      <option key={fmt.value} value={fmt.value}>
                        {fmt.label} — {fmt.desc}
                      </option>
                    ))}
                  </select>
                )}

                {/* Optional provider name */}
                {f.provider && (
                  <input
                    type="text"
                    placeholder="Card nickname (optional, e.g. Citi Costco, BofA Checking)"
                    value={f.providerName || ''}
                    onChange={e => updateProviderName(i, e.target.value)}
                    className="text-xs rounded-lg border border-gray-200
                               dark:border-gray-600 bg-white dark:bg-gray-800
                               text-gray-700 dark:text-gray-300 px-2 py-1.5
                               outline-none w-full max-w-xs
                               focus:ring-1 focus:ring-blue-500"
                  />
                )}

                {/* Status */}
                {f.status === 'importing' && (
                  <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600
                                  rounded-full animate-spin" />
                )}
                {f.status === 'success' && (
                  <div className="text-right">
                    <CheckCircle size={18} className="text-green-500 mb-0.5" />
                    <p className="text-xs text-green-600">
                      {f.result?.imported} imported
                    </p>
                  </div>
                )}
                {f.status === 'error' && (
                  <div className="text-right">
                    <AlertCircle size={18} className="text-red-500 mb-0.5" />
                    <p className="text-xs text-red-500 max-w-[120px] truncate">{f.error}</p>
                  </div>
                )}

                {f.status === 'pending' && (
                  <button onClick={() => removeFile(i)}
                          className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Import results summary */}
          {files.some(f => f.status === 'success') && (
            <div className="mt-4 p-3 rounded-xl bg-green-50 dark:bg-green-900/20
                            border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                Import complete
              </p>
              {files.filter(f => f.status === 'success').map((f, i) => (
                <p key={i} className="text-xs text-green-600 dark:text-green-500">
                  {f.file.name}: {f.result?.imported} imported,{' '}
                  {f.result?.duplicates} duplicates,{' '}
                  {f.result?.skipped} skipped
                </p>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={importAll}
              disabled={!canImport || importing}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700
                         disabled:opacity-50 text-white font-medium text-sm
                         transition-colors flex items-center gap-2"
            >
              <Upload size={15} />
              {importing ? 'Importing…' : `Import ${pendingCount} file${pendingCount !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => setFiles([])}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600
                         text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-50
                         dark:hover:bg-gray-700 transition-colors"
            >
              Clear all
            </button>
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <SectionTitle>File Naming Convention</SectionTitle>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p>Name your files with a recognizable prefix for automatic format detection:</p>
          <p className="text-xs text-gray-400 mt-1">
            citi_, amex_, discover_, chase_, boa_, wellsfargo_ → auto-detected
          </p>
          <div className="mt-2 space-y-1 font-mono text-xs bg-gray-50 dark:bg-gray-700/30
                          rounded-lg p-3">
            <p><span className="text-blue-600">citi_</span>john_2025.csv</p>
            <p><span className="text-blue-600">citi_</span>jane_2025.csv</p>
            <p><span className="text-blue-600">amex_</span>john_2025.csv</p>
            <p><span className="text-blue-600">chase_</span>shared_2025.csv</p>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Chase purchases are negative in the CSV — the app flips them automatically.
            Duplicate transactions are detected and skipped on re-import.
          </p>
        </div>
      </Card>
    </div>
  )
}
