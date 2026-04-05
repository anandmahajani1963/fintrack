import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { analytics, transactions } from '../api/client'
import { Card, Loading, ErrorMsg, SectionTitle, Badge, fmtDec } from '../components/ui'
import { AlertCircle, CheckCircle, Save, RotateCcw, Plus, X } from 'lucide-react'

const ESSENTIAL_OPTIONS = [
  { value: true,  label: 'Essential' },
  { value: false, label: 'Discretionary' },
]

const COLOR_OPTIONS = [
  '#2563eb','#16a34a','#ea580c','#7c3aed','#dc2626',
  '#0891b2','#d97706','#059669','#db2777','#6b7280',
]

export default function Reconciliation({ year }) {
  const { password }        = useAuth()
  const [catData, setCat]   = useState(null)
  const [others, setOthers] = useState(null)
  const [allCats, setAllCats] = useState([])
  const [pending, setPending] = useState({})
  const [saving, setSaving]   = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const [error, setError]     = useState('')

  // Add category form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newCat, setNewCat] = useState({
    name: '', subcategory: '', is_essential: false, color_code: '#6b7280'
  })
  const [addError, setAddError]   = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addSuccess, setAddSuccess] = useState('')

  const load = useCallback(() => {
    if (!password) return
    setCat(null); setOthers(null); setError('')
    setPending({}); setSaveResult(null)

    analytics.categorySummary(year)
      .then(setCat).catch(e => setError(e.message))

    transactions.list(password, { year, category: 'Other', page_size: 200 })
      .then(d => setOthers(d.items)).catch(e => setError(e.message))
  }, [password, year])

  useEffect(() => { load() }, [load])

  // Load ALL categories for dropdown — sorted alphabetically
  const loadCats = useCallback(() => {
    transactions.categories()
      .then(cats => {
        const opts = cats
          .filter(c => c.name !== 'Other')
          .map(c => ({
            value: `${c.name}|||${c.subcategory}`,
            label: c.name === c.subcategory
              ? c.name
              : `${c.name} / ${c.subcategory}`,
            category: c.name,
            subcategory: c.subcategory,
          }))
          .sort((a, b) => a.label.localeCompare(b.label))  // ← sorted here
        opts.push({ value: 'Other|||Other', label: 'Other',
                    category: 'Other', subcategory: 'Other' })
        setAllCats(opts)
      })
      .catch(() => {})
  }, [])

  useEffect(() => { loadCats() }, [loadCats])

  function handleCategoryChange(txnId, value) {
    const [cat, sub] = value.split('|||')
    setPending(prev => ({ ...prev, [txnId]: { category_name: cat, subcategory: sub } }))
    setSaveResult(null)
  }

  async function saveAll() {
    const entries = Object.entries(pending)
    if (entries.length === 0) return
    setSaving(true); setSaveResult(null)
    let saved = 0, failed = 0
    for (const [txnId, update] of entries) {
      try {
        await transactions.updateCategory(txnId, update.category_name, update.subcategory)
        saved++
      } catch { failed++ }
    }
    setSaveResult({ saved, failed })
    setSaving(false)
    if (saved > 0) { setPending({}); load() }
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCat.name.trim()) { setAddError('Category name is required'); return }
    setAddSaving(true); setAddError(''); setAddSuccess('')

    try {
      await transactions.createCategory({
        name:         newCat.name.trim(),
        subcategory:  newCat.subcategory.trim() || newCat.name.trim(),
        is_essential: newCat.is_essential,
        color_code:   newCat.color_code,
      })
      const label = newCat.subcategory.trim()
        ? `${newCat.name} / ${newCat.subcategory}`
        : newCat.name
      setAddSuccess(`✓ Added: ${label}`)
      setNewCat({ name: '', subcategory: '', is_essential: false, color_code: '#6b7280' })
      loadCats()
    } catch (err) {
      setAddError(err.message)
    }
    setAddSaving(false)
  }

  if (error)              return <ErrorMsg message={error} />
  if (!catData || !others) return <Loading />

  const otherCat   = catData.categories.find(c => c.category === 'Other')
  const otherPct   = otherCat?.pct || 0
  const otherTotal = otherCat?.total || 0
  const pendingCount   = Object.keys(pending).length
  const sortedOthers   = [...others].sort((a, b) => b.amount - a.amount)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reconciliation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Review and fix uncategorised transactions — {year}
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(f => !f); setAddError(''); setAddSuccess('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg
                     bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium
                     transition-colors"
        >
          {showAddForm ? <X size={15} /> : <Plus size={15} />}
          {showAddForm ? 'Cancel' : 'Add Category'}
        </button>
      </div>

      {/* Add category form */}
      {showAddForm && (
        <Card>
          <SectionTitle>Add New Category</SectionTitle>
          <form onSubmit={handleAddCategory} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500
                                   dark:text-gray-400 uppercase mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCat.name}
                  onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Travel"
                  className="w-full px-3 py-2 text-sm rounded-lg border
                             border-gray-200 dark:border-gray-600
                             bg-white dark:bg-gray-700
                             text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500
                                   dark:text-gray-400 uppercase mb-1">
                  Subcategory
                  <span className="normal-case font-normal ml-1 text-gray-400">
                    (leave blank to match category name)
                  </span>
                </label>
                <input
                  type="text"
                  value={newCat.subcategory}
                  onChange={e => setNewCat(p => ({ ...p, subcategory: e.target.value }))}
                  placeholder="e.g. International"
                  className="w-full px-3 py-2 text-sm rounded-lg border
                             border-gray-200 dark:border-gray-600
                             bg-white dark:bg-gray-700
                             text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500
                                   dark:text-gray-400 uppercase mb-1">Type</label>
                <select
                  value={String(newCat.is_essential)}
                  onChange={e => setNewCat(p => ({
                    ...p, is_essential: e.target.value === 'true'
                  }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border
                             border-gray-200 dark:border-gray-600
                             bg-white dark:bg-gray-700
                             text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="false">Discretionary</option>
                  <option value="true">Essential</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500
                                   dark:text-gray-400 uppercase mb-1">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCat(p => ({ ...p, color_code: color }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform
                                  ${newCat.color_code === color
                                    ? 'border-gray-900 dark:border-white scale-110'
                                    : 'border-transparent'}`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-lg
                            bg-gray-50 dark:bg-gray-700/30 text-sm">
              <span className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: newCat.color_code }} />
              <span className="font-medium text-gray-900 dark:text-white">
                {newCat.name || 'Category Name'}
                {newCat.subcategory && newCat.subcategory !== newCat.name &&
                  <span className="text-gray-400"> / {newCat.subcategory}</span>}
              </span>
              <Badge color={newCat.is_essential ? 'green' : 'blue'}>
                {newCat.is_essential ? 'Essential' : 'Discretionary'}
              </Badge>
            </div>

            {addError && (
              <p className="text-sm text-red-600 dark:text-red-400 bg-red-50
                            dark:bg-red-900/20 rounded-lg px-3 py-2">{addError}</p>
            )}
            {addSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400 bg-green-50
                            dark:bg-green-900/20 rounded-lg px-3 py-2">{addSuccess}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={addSaving || !newCat.name.trim()}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700
                           disabled:opacity-50 text-white font-medium text-sm
                           transition-colors flex items-center gap-2"
              >
                <Plus size={14} />
                {addSaving ? 'Adding…' : 'Add Category'}
              </button>
              <button
                type="button"
                onClick={() => setNewCat({
                  name: '', subcategory: '', is_essential: false, color_code: '#6b7280'
                })}
                className="px-4 py-2 rounded-lg border border-gray-200
                           dark:border-gray-600 text-gray-600 dark:text-gray-400
                           text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Clear
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Other summary banner */}
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
            {otherPct < 5
              ? `Great — only ${otherPct}% uncategorised`
              : `${otherPct}% uncategorised — assign categories below`}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
            {others.length} transactions · {fmtDec(otherTotal)} · {otherPct}% of total spend
          </p>
        </div>
      </div>

      {saveResult && (
        <div className={`rounded-xl p-4 text-sm font-medium
                         ${saveResult.failed === 0
                           ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                           : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                         }`}>
          {saveResult.saved} transaction{saveResult.saved !== 1 ? 's' : ''} updated
          {saveResult.failed > 0 && ` · ${saveResult.failed} failed`}
        </div>
      )}

      {/* Uncategorised transactions */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Uncategorised Transactions ({others.length})</SectionTitle>
          {pendingCount > 0 && (
            <div className="flex gap-2">
              <button onClick={() => { setPending({}); setSaveResult(null) }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm
                                 text-gray-500 border border-gray-200 dark:border-gray-600
                                 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                <RotateCcw size={13} /> Reset
              </button>
              <button onClick={saveAll} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 text-sm
                                 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                 text-white rounded-lg font-medium">
                <Save size={13} />
                {saving ? 'Saving…' : `Save ${pendingCount} change${pendingCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>

        {others.length === 0 ? (
          <p className="text-sm text-green-600 dark:text-green-400 py-4">
            ✓ All transactions are categorised
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {['Date','Description','Amount','Card','Assign Category'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-medium
                                           text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedOthers.map(t => {
                  const hasPending = !!pending[t.id]
                  return (
                    <tr key={t.id}
                        className={hasPending
                          ? 'bg-blue-50 dark:bg-blue-900/10'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}>
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{t.date}</td>
                      <td className="py-2.5 px-3 text-gray-900 dark:text-white max-w-xs truncate">
                        {t.description}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold
                                     text-gray-900 dark:text-white whitespace-nowrap">
                        {fmtDec(t.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 capitalize">
                        {t.source_file?.split('_')[0] || '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={pending[t.id]
                            ? `${pending[t.id].category_name}|||${pending[t.id].subcategory}`
                            : 'Other|||Other'}
                          onChange={e => handleCategoryChange(t.id, e.target.value)}
                          className="text-sm rounded-lg border border-gray-200
                                     dark:border-gray-600 bg-white dark:bg-gray-800
                                     text-gray-700 dark:text-gray-300 px-2 py-1.5
                                     outline-none w-full max-w-[220px]
                                     focus:ring-2 focus:ring-blue-500"
                        >
                          {allCats.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {others.length > 5 && pendingCount > 0 && (
          <div className="mt-4 flex justify-end">
            <button onClick={saveAll} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 text-sm
                               bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                               text-white rounded-lg font-medium">
              <Save size={14} />
              {saving ? 'Saving…' : `Save ${pendingCount} change${pendingCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </Card>

      {/* Category totals cross-check */}
      <Card>
        <SectionTitle>All Category Totals</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr>
                {['Category','Subcategory','Total','%','Txns','Type'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-medium
                                         text-gray-500 dark:text-gray-400 uppercase">{h}</th>
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
                  <td className="py-2.5 px-3 text-right font-semibold
                                 text-gray-900 dark:text-white">{fmtDec(c.total)}</td>
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
