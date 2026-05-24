// ============================================================
// fintrack mobile — Budgets screen
// File: src/screens/BudgetsScreen.js
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

function statusColor(status) {
  return status === 'red'   ? '#EF4444'
       : status === 'amber' ? '#F59E0B'
       : '#10B981'
}

function BudgetCard({ item, c }) {
  const pct     = item.pct_used || 0
  const barPct  = Math.min(pct, 100)
  const color   = statusColor(item.status)

  return (
    <View style={[styles.card, { backgroundColor: c.card }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.catName, { color: c.text }]} numberOfLines={1}>
            {item.category_name}
          </Text>
          {item.subcategory && item.subcategory !== item.category_name && (
            <Text style={[styles.catSub, { color: c.muted }]}>{item.subcategory}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + '20', borderColor: color }]}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>
            {item.status === 'red' ? 'Exceeded' : item.status === 'amber' ? 'Near limit' : 'On track'}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.barBg, { backgroundColor: c.border }]}>
        <View style={[styles.barFill, { width: `${barPct}%`, backgroundColor: color }]} />
      </View>

      {/* Amounts */}
      <View style={styles.amounts}>
        <View>
          <Text style={[styles.amountLabel, { color: c.muted }]}>Spent</Text>
          <Text style={[styles.amountValue, { color: c.text }]}>{fmt(item.spent)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.amountLabel, { color: c.muted }]}>Used</Text>
          <Text style={[styles.amountValue, { color }]}>{pct.toFixed(0)}%</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.amountLabel, { color: c.muted }]}>Budget</Text>
          <Text style={[styles.amountValue, { color: c.text }]}>{fmt(item.threshold)}</Text>
        </View>
      </View>

      {/* Period */}
      <Text style={[styles.period, { color: c.muted }]}>
        {item.period === 'monthly' ? '📅 Monthly' : '📆 Annual'} budget
        {item.remaining >= 0
          ? ` · ${fmt(item.remaining)} remaining`
          : ` · ${fmt(Math.abs(item.remaining))} over budget`}
      </Text>
    </View>
  )
}

export default function BudgetsScreen() {
  const scheme = useColorScheme()
  const dark   = scheme === 'dark'
  const c      = dark ? darkColors : lightColors

  const [year, setYear]           = useState(2025)
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState('')
  const [filter, setFilter]       = useState('all') // all | red | amber | green

  const load = useCallback(async () => {
    setError('')
    try {
      const { data: d } = await analytics.budgetStatus(year)
      setData(d)
    } catch (err) {
      setError(err.message || 'Failed to load budgets')
    }
    setLoading(false)
    setRefreshing(false)
  }, [year])

  useEffect(() => { setLoading(true); load() }, [load])

  const budgets = data?.budgets || []
  const alerts  = data?.alerts  || []

  const filtered = filter === 'all' ? budgets
    : budgets.filter(b => b.status === filter)

  const exceeded  = budgets.filter(b => b.status === 'red').length
  const nearLimit = budgets.filter(b => b.status === 'amber').length
  const onTrack   = budgets.filter(b => b.status === 'green').length

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.card }]}>
        <Text style={[styles.title, { color: c.text }]}>Budgets</Text>

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

        {/* Summary */}
        {data && budgets.length > 0 && (
          <View style={styles.summaryRow}>
            <TouchableOpacity onPress={() => setFilter('red')}
              style={[styles.summaryCard, { backgroundColor: '#FEF2F2',
                borderWidth: filter === 'red' ? 2 : 0, borderColor: '#EF4444' }]}>
              <Text style={[styles.summaryNum, { color: '#EF4444' }]}>{exceeded}</Text>
              <Text style={[styles.summaryLabel, { color: '#EF4444' }]}>Exceeded</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFilter('amber')}
              style={[styles.summaryCard, { backgroundColor: '#FFFBEB',
                borderWidth: filter === 'amber' ? 2 : 0, borderColor: '#F59E0B' }]}>
              <Text style={[styles.summaryNum, { color: '#F59E0B' }]}>{nearLimit}</Text>
              <Text style={[styles.summaryLabel, { color: '#F59E0B' }]}>Near limit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFilter('green')}
              style={[styles.summaryCard, { backgroundColor: '#F0FDF4',
                borderWidth: filter === 'green' ? 2 : 0, borderColor: '#10B981' }]}>
              <Text style={[styles.summaryNum, { color: '#10B981' }]}>{onTrack}</Text>
              <Text style={[styles.summaryLabel, { color: '#10B981' }]}>On track</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFilter('all')}
              style={[styles.summaryCard, { backgroundColor: c.bg,
                borderWidth: filter === 'all' ? 2 : 0, borderColor: '#6B7280' }]}>
              <Text style={[styles.summaryNum, { color: c.text }]}>{budgets.length}</Text>
              <Text style={[styles.summaryLabel, { color: c.muted }]}>Total</Text>
            </TouchableOpacity>
          </View>
        )}
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
      ) : budgets.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🎯</Text>
          <Text style={[styles.emptyTitle, { color: c.text }]}>No budgets set</Text>
          <Text style={[styles.emptyDesc, { color: c.muted }]}>
            Set budgets in the web app to track your spending limits here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => `${item.category_name}-${item.subcategory}-${i}`}
          renderItem={({ item }) => <BudgetCard item={item} c={c} />}
          refreshControl={
            <RefreshControl refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load() }} />
          }
          contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: c.muted }]}>
              No budgets match this filter
            </Text>
          }
          ListFooterComponent={
            filtered.length > 0
              ? <Text style={[styles.footerText, { color: c.muted }]}>
                  {filtered.length} budget{filtered.length > 1 ? 's' : ''}
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
  summaryNum:   { fontSize: 22, fontWeight: 'bold' },
  summaryLabel: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  card:         { borderRadius: 14, padding: 14, gap: 10 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  catName:      { fontSize: 15, fontWeight: '600' },
  catSub:       { fontSize: 12, marginTop: 1 },
  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 8, paddingVertical: 4,
                  borderRadius: 8, borderWidth: 1 },
  statusDot:    { width: 6, height: 6, borderRadius: 3 },
  statusText:   { fontSize: 11, fontWeight: '600' },
  barBg:        { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill:      { height: 6, borderRadius: 3 },
  amounts:      { flexDirection: 'row', justifyContent: 'space-between' },
  amountLabel:  { fontSize: 11, marginBottom: 2 },
  amountValue:  { fontSize: 15, fontWeight: '700' },
  period:       { fontSize: 11 },
  errorBox:     { padding: 24, alignItems: 'center' },
  errorText:    { color: '#EF4444', fontSize: 14, marginBottom: 12 },
  retryBtn:     { backgroundColor: '#2563EB', paddingHorizontal: 20,
                  paddingVertical: 10, borderRadius: 8 },
  retryText:    { color: '#fff', fontWeight: '600' },
  emptyBox:     { flex: 1, alignItems: 'center', justifyContent: 'center',
                  padding: 40 },
  emptyTitle:   { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyDesc:    { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyText:    { textAlign: 'center', padding: 40, fontSize: 15 },
  footerText:   { textAlign: 'center', padding: 16, fontSize: 12 },
})
