// ============================================================
// fintrack mobile — Categories screen
// File: src/screens/CategoriesScreen.js
// Version: 1.0 — 2026-05-24
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  useColorScheme, ActivityIndicator, RefreshControl,
} from 'react-native'
import { analytics } from '../api/client'

const YEARS = [2026, 2025, 2024, 2023]

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

function CategoryRow({ item, c, grandTotal }) {
  const pct = grandTotal > 0 ? ((item.total / grandTotal) * 100).toFixed(1) : 0
  const barWidth = grandTotal > 0 ? Math.min((item.total / grandTotal) * 100, 100) : 0

  return (
    <View style={[styles.row, { backgroundColor: c.card }]}>
      <View style={styles.rowTop}>
        <View style={styles.rowLeft}>
          <View style={[styles.dot, { backgroundColor: item.color_code || '#6B7280' }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.catName, { color: c.text }]} numberOfLines={1}>
              {item.category}
            </Text>
            {item.subcategory && item.subcategory !== item.category && (
              <Text style={[styles.catSub, { color: c.muted }]} numberOfLines={1}>
                {item.subcategory}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.amount, { color: c.text }]}>{fmt(item.total)}</Text>
          <Text style={[styles.pct, { color: c.muted }]}>{pct}%</Text>
        </View>
      </View>
      {/* Progress bar */}
      <View style={[styles.barBg, { backgroundColor: c.border }]}>
        <View style={[styles.barFill, {
          width: `${barWidth}%`,
          backgroundColor: item.color_code || '#6B7280',
          opacity: 0.7,
        }]} />
      </View>
      <View style={styles.rowMeta}>
        <Text style={[styles.metaText, { color: c.muted }]}>
          {item.txn_count} transactions
        </Text>
        <Text style={[styles.metaText, {
          color: item.is_essential ? '#10B981' : '#6B7280'
        }]}>
          {item.is_essential ? 'Essential' : 'Discretionary'}
        </Text>
      </View>
    </View>
  )
}

export default function CategoriesScreen() {
  const scheme = useColorScheme()
  const dark   = scheme === 'dark'
  const c      = dark ? darkColors : lightColors

  const [year, setYear]           = useState(2025)
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState('')
  const [filter, setFilter]       = useState('all') // all | essential | discretionary

  const load = useCallback(async () => {
    setError('')
    try {
      const { data: d } = await analytics.categorySummary(year)
      setData(d)
    } catch (err) {
      setError(err.message || 'Failed to load categories')
    }
    setLoading(false)
    setRefreshing(false)
  }, [year])

  useEffect(() => { setLoading(true); load() }, [load])

  const cats = data?.categories || []
  const filtered = filter === 'all' ? cats
    : filter === 'essential' ? cats.filter(c => c.is_essential)
    : cats.filter(c => !c.is_essential)

  const grandTotal = data?.grand_total || 0
  const essentialTotal = cats.filter(c => c.is_essential).reduce((s, c) => s + c.total, 0)
  const discretTotal   = cats.filter(c => !c.is_essential).reduce((s, c) => s + c.total, 0)

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.card }]}>
        <Text style={[styles.title, { color: c.text }]}>Categories</Text>

        {/* Year selector */}
        <View style={styles.yearRow}>
          {YEARS.map(y => (
            <TouchableOpacity key={y} onPress={() => setYear(y)}
              style={[styles.yearBtn, y === year && { backgroundColor: '#2563EB' }]}>
              <Text style={[styles.yearText, { color: y === year ? '#fff' : c.muted }]}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary cards */}
        {data && (
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: c.bg }]}>
              <Text style={[styles.summaryLabel, { color: c.muted }]}>Total</Text>
              <Text style={[styles.summaryValue, { color: c.text }]}>{fmt(grandTotal)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5' }]}>
              <Text style={[styles.summaryLabel, { color: '#10B981' }]}>Essential</Text>
              <Text style={[styles.summaryValue, { color: '#065F46' }]}>{fmt(essentialTotal)}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: dark ? '#1E3A8A' : '#EFF6FF' }]}>
              <Text style={[styles.summaryLabel, { color: '#2563EB' }]}>Discret.</Text>
              <Text style={[styles.summaryValue, { color: dark ? '#93C5FD' : '#1D4ED8' }]}>{fmt(discretTotal)}</Text>
            </View>
          </View>
        )}

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          {[['all', 'All'], ['essential', 'Essential'], ['discretionary', 'Discretionary']].map(([val, label]) => (
            <TouchableOpacity key={val} onPress={() => setFilter(val)}
              style={[styles.filterBtn,
                filter === val && { backgroundColor: '#2563EB', borderColor: '#2563EB' },
                { borderColor: c.border }]}>
              <Text style={[styles.filterText,
                { color: filter === val ? '#fff' : c.muted }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => `${item.category}-${item.subcategory}-${i}`}
          renderItem={({ item }) => (
            <CategoryRow item={item} c={c} grandTotal={grandTotal} />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load() }} />
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: c.muted }]}>
              No categories found
            </Text>
          }
          ListFooterComponent={
            filtered.length > 0
              ? <Text style={[styles.footerText, { color: c.muted }]}>
                  {filtered.length} categories
                </Text>
              : null
          }
        />
      )}
    </View>
  )
}

const lightColors = {
  bg: '#F9FAFB', card: '#FFFFFF', text: '#111827', muted: '#6B7280',
  border: '#E5E7EB',
}
const darkColors = {
  bg: '#111827', card: '#1F2937', text: '#F9FAFB', muted: '#9CA3AF',
  border: '#374151',
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  header:       { padding: 16, paddingTop: 56, gap: 10 },
  title:        { fontSize: 22, fontWeight: 'bold' },
  yearRow:      { flexDirection: 'row', gap: 8 },
  yearBtn:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  yearText:     { fontSize: 13, fontWeight: '500' },
  summaryRow:   { flexDirection: 'row', gap: 8 },
  summaryCard:  { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  summaryLabel: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: 'bold' },
  filterRow:    { flexDirection: 'row', gap: 8 },
  filterBtn:    { flex: 1, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
                  alignItems: 'center' },
  filterText:   { fontSize: 12, fontWeight: '500' },
  row:          { marginHorizontal: 12, marginVertical: 5, borderRadius: 12,
                  padding: 14, gap: 8 },
  rowTop:       { flexDirection: 'row', justifyContent: 'space-between',
                  alignItems: 'center' },
  rowLeft:      { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot:          { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  catName:      { fontSize: 14, fontWeight: '600' },
  catSub:       { fontSize: 12, marginTop: 1 },
  rowRight:     { alignItems: 'flex-end' },
  amount:       { fontSize: 15, fontWeight: '700' },
  pct:          { fontSize: 11, marginTop: 1 },
  barBg:        { height: 4, borderRadius: 2, overflow: 'hidden' },
  barFill:      { height: 4, borderRadius: 2 },
  rowMeta:      { flexDirection: 'row', justifyContent: 'space-between' },
  metaText:     { fontSize: 11 },
  errorBox:     { padding: 24, alignItems: 'center' },
  errorText:    { color: '#EF4444', fontSize: 14, marginBottom: 12 },
  retryBtn:     { backgroundColor: '#2563EB', paddingHorizontal: 20,
                  paddingVertical: 10, borderRadius: 8 },
  retryText:    { color: '#fff', fontWeight: '600' },
  emptyText:    { textAlign: 'center', padding: 40, fontSize: 15 },
  footerText:   { textAlign: 'center', padding: 16, fontSize: 12 },
})
