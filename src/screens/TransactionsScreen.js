// ============================================================
// fintrack mobile — Transactions screen
// File: src/screens/TransactionsScreen.js
// Version: 1.0 — 2026-04-20
// ============================================================

import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, StyleSheet,
  TouchableOpacity, useColorScheme, ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { transactions } from '../api/client'

const YEARS = [2026, 2025, 2024, 2023]

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })
}

function TransactionRow({ item, c }) {
  return (
    <View style={[styles.row, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.desc, { color: c.text }]} numberOfLines={1}>
          {item.description}
        </Text>
        <Text style={[styles.meta, { color: c.muted }]}>
          {item.date} · {item.category_name}
          {item.subcategory && item.subcategory !== item.category_name
            ? ` / ${item.subcategory}` : ''}
        </Text>
      </View>
      <Text style={[styles.amount, { color: c.text }]}>{fmt(item.amount)}</Text>
    </View>
  )
}

export default function TransactionsScreen() {
  const scheme = useColorScheme()
  const dark   = scheme === 'dark'
  const c      = dark ? darkColors : lightColors

  const [year, setYear]         = useState(2026)
  const [search, setSearch]     = useState('')
  const [items, setItems]       = useState([])
  const [page, setPage]         = useState(1)
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]       = useState('')

  const PAGE_SIZE = 50

  const load = useCallback(async (pg = 1, reset = true) => {
    if (pg === 1) setError('')
    try {
      const { data } = await transactions.list({
        year,
        page: pg,
        page_size: PAGE_SIZE,
        ...(search ? { search } : {}),
      })
      if (reset) {
        setItems(data.items || [])
      } else {
        setItems(prev => [...prev, ...(data.items || [])])
      }
      setTotal(data.total || 0)
      setPage(pg)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load transactions')
    }
    setLoading(false)
    setRefreshing(false)
    setLoadingMore(false)
  }, [year, search])

  useEffect(() => {
    setLoading(true)
    setItems([])
    load(1, true)
  }, [load])

  function onRefresh() {
    setRefreshing(true)
    load(1, true)
  }

  function loadMore() {
    if (loadingMore || items.length >= total) return
    setLoadingMore(true)
    load(page + 1, false)
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.card }]}>
        <Text style={[styles.title, { color: c.text }]}>Transactions</Text>

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
                { color: y === year ? '#fff' : c.muted }]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <TextInput
          style={[styles.search, { backgroundColor: c.input,
                                    color: c.text, borderColor: c.border }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search transactions…"
          placeholderTextColor={c.placeholder}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        <Text style={[styles.count, { color: c.muted }]}>
          {total} transactions
        </Text>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(1, true)} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <TransactionRow item={item} c={c} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color="#2563EB" style={{ padding: 16 }} />
              : items.length >= total && items.length > 0
              ? <Text style={[styles.endText, { color: c.muted }]}>
                  All {total} transactions loaded
                </Text>
              : null
          }
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: c.muted }]}>
              No transactions found
            </Text>
          }
        />
      )}
    </View>
  )
}

const lightColors = {
  bg: '#F9FAFB', card: '#FFFFFF', text: '#111827', muted: '#6B7280',
  input: '#F3F4F6', border: '#E5E7EB', placeholder: '#9CA3AF',
}
const darkColors = {
  bg: '#111827', card: '#1F2937', text: '#F9FAFB', muted: '#9CA3AF',
  input: '#374151', border: '#4B5563', placeholder: '#6B7280',
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { padding: 16, paddingTop: 56, gap: 10 },
  title:       { fontSize: 22, fontWeight: 'bold' },
  yearRow:     { flexDirection: 'row', gap: 8 },
  yearBtn:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  yearText:    { fontSize: 13, fontWeight: '500' },
  search:      { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14,
                 paddingVertical: 10, fontSize: 15 },
  count:       { fontSize: 13 },
  row:         { flexDirection: 'row', alignItems: 'center', padding: 14,
                 borderBottomWidth: StyleSheet.hairlineWidth },
  rowLeft:     { flex: 1, marginRight: 12 },
  desc:        { fontSize: 14, fontWeight: '500', marginBottom: 3 },
  meta:        { fontSize: 12 },
  amount:      { fontSize: 15, fontWeight: '700' },
  errorBox:    { padding: 24, alignItems: 'center' },
  errorText:   { color: '#EF4444', fontSize: 14, marginBottom: 12 },
  retryBtn:    { backgroundColor: '#2563EB', paddingHorizontal: 20,
                 paddingVertical: 10, borderRadius: 8 },
  retryText:   { color: '#fff', fontWeight: '600' },
  endText:     { textAlign: 'center', padding: 16, fontSize: 13 },
  emptyText:   { textAlign: 'center', padding: 40, fontSize: 15 },
})
