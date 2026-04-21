// ============================================================
// fintrack mobile — Dashboard screen
// File: src/screens/DashboardScreen.js
// Version: 1.0 — 2026-04-20
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, useColorScheme, ActivityIndicator,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import { analytics } from '../api/client'

const YEARS = [2026, 2025, 2024, 2023]

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })
}

function StatusDot({ status }) {
  const color = status === 'red' ? '#EF4444'
              : status === 'amber' ? '#F59E0B' : '#10B981'
  return <View style={[styles.dot, { backgroundColor: color }]} />
}

export default function DashboardScreen() {
  const { user } = useAuth()
  const scheme   = useColorScheme()
  const dark     = scheme === 'dark'
  const c        = dark ? darkColors : lightColors

  const [year, setYear]           = useState(2026)
  const [summary, setSummary]     = useState(null)
  const [budgets, setBudgets]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [sumRes, budRes] = await Promise.all([
        analytics.categorySummary(year),
        analytics.budgetStatus(year),
      ])
      setSummary(sumRes.data)
      setBudgets(budRes.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load data')
    }
    setLoading(false)
    setRefreshing(false)
  }, [year])

  useEffect(() => { setLoading(true); load() }, [load])

  function onRefresh() { setRefreshing(true); load() }

  const alerts = budgets?.alerts || []
  const cats   = summary?.categories || []
  const top5   = [...cats].sort((a, b) => b.total - a.total).slice(0, 5)

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: c.bg }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.card }]}>
        <View>
          <Text style={[styles.greeting, { color: c.muted }]}>
            Welcome back
          </Text>
          <Text style={[styles.email, { color: c.text }]}>
            {user?.email}
          </Text>
        </View>
        {/* Year selector */}
        <View style={styles.yearRow}>
          {YEARS.map(y => (
            <TouchableOpacity
              key={y}
              onPress={() => setYear(y)}
              style={[styles.yearBtn,
                y === year && { backgroundColor: '#2563EB' }]}
            >
              <Text style={[styles.yearText,
                { color: y === year ? '#fff' : c.muted }]}>
                {y}
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
        <View style={styles.content}>

          {/* Grand Total Card */}
          <View style={[styles.totalCard, { backgroundColor: '#2563EB' }]}>
            <Text style={styles.totalLabel}>{year} Total Spending</Text>
            <Text style={styles.totalAmount}>{fmt(summary?.grand_total)}</Text>
            <Text style={styles.totalSub}>
              {cats.length} categories · {cats.reduce((s, c) => s + c.txn_count, 0)} transactions
            </Text>
          </View>

          {/* Budget Alerts */}
          {alerts.length > 0 && (
            <View style={[styles.section, { backgroundColor: c.card }]}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                ⚠️ Budget Alerts
              </Text>
              {alerts.map((a, i) => (
                <View key={i} style={styles.alertRow}>
                  <StatusDot status={a.status} />
                  <Text style={[styles.alertText, { color: c.text }]}>
                    {a.message}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Top 5 Categories */}
          <View style={[styles.section, { backgroundColor: c.card }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>
              Top Categories
            </Text>
            {top5.map((cat, i) => (
              <View key={i} style={styles.catRow}>
                <View style={styles.catLeft}>
                  <View style={[styles.catDot,
                    { backgroundColor: cat.color_code || '#6B7280' }]} />
                  <View>
                    <Text style={[styles.catName, { color: c.text }]}>
                      {cat.category}
                    </Text>
                    {cat.subcategory !== cat.category && (
                      <Text style={[styles.catSub, { color: c.muted }]}>
                        {cat.subcategory}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.catRight}>
                  <Text style={[styles.catAmount, { color: c.text }]}>
                    {fmt(cat.total)}
                  </Text>
                  <Text style={[styles.catPct, { color: c.muted }]}>
                    {cat.pct}%
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Essential vs Discretionary */}
          {summary && (
            <View style={[styles.section, { backgroundColor: c.card }]}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>
                Spending Breakdown
              </Text>
              <View style={styles.breakdownRow}>
                <View style={[styles.breakdownCard,
                              { backgroundColor: dark ? '#064E3B' : '#ECFDF5' }]}>
                  <Text style={[styles.breakdownLabel, { color: '#10B981' }]}>
                    Essential
                  </Text>
                  <Text style={[styles.breakdownAmount, { color: c.text }]}>
                    {fmt(cats.filter(c => c.is_essential).reduce((s, c) => s + c.total, 0))}
                  </Text>
                </View>
                <View style={[styles.breakdownCard,
                              { backgroundColor: dark ? '#1E3A8A' : '#EFF6FF' }]}>
                  <Text style={[styles.breakdownLabel, { color: '#2563EB' }]}>
                    Discretionary
                  </Text>
                  <Text style={[styles.breakdownAmount, { color: c.text }]}>
                    {fmt(cats.filter(c => !c.is_essential).reduce((s, c) => s + c.total, 0))}
                  </Text>
                </View>
              </View>
            </View>
          )}

        </View>
      )}
    </ScrollView>
  )
}

const lightColors = {
  bg: '#F9FAFB', card: '#FFFFFF', text: '#111827', muted: '#6B7280', border: '#E5E7EB',
}
const darkColors = {
  bg: '#111827', card: '#1F2937', text: '#F9FAFB', muted: '#9CA3AF', border: '#374151',
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { padding: 20, paddingTop: 56, marginBottom: 2 },
  greeting:        { fontSize: 13 },
  email:           { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  yearRow:         { flexDirection: 'row', gap: 8 },
  yearBtn:         { paddingHorizontal: 10, paddingVertical: 5,
                     borderRadius: 8, backgroundColor: 'transparent' },
  yearText:        { fontSize: 13, fontWeight: '500' },
  content:         { padding: 16, gap: 12 },
  totalCard:       { borderRadius: 16, padding: 24, alignItems: 'center' },
  totalLabel:      { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginBottom: 8 },
  totalAmount:     { color: '#fff', fontSize: 36, fontWeight: 'bold', marginBottom: 4 },
  totalSub:        { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  section:         { borderRadius: 16, padding: 16, gap: 12 },
  sectionTitle:    { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  alertRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertText:       { fontSize: 13, flex: 1 },
  dot:             { width: 8, height: 8, borderRadius: 4 },
  catRow:          { flexDirection: 'row', justifyContent: 'space-between',
                     alignItems: 'center' },
  catLeft:         { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  catDot:          { width: 10, height: 10, borderRadius: 5 },
  catName:         { fontSize: 14, fontWeight: '500' },
  catSub:          { fontSize: 12, marginTop: 1 },
  catRight:        { alignItems: 'flex-end' },
  catAmount:       { fontSize: 14, fontWeight: '600' },
  catPct:          { fontSize: 12, marginTop: 1 },
  breakdownRow:    { flexDirection: 'row', gap: 12 },
  breakdownCard:   { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  breakdownLabel:  { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  breakdownAmount: { fontSize: 16, fontWeight: 'bold' },
  errorBox:        { padding: 24, alignItems: 'center' },
  errorText:       { color: '#EF4444', fontSize: 14, marginBottom: 12 },
  retryBtn:        { backgroundColor: '#2563EB', paddingHorizontal: 20,
                     paddingVertical: 10, borderRadius: 8 },
  retryText:       { color: '#fff', fontWeight: '600' },
})
