// ============================================================
// fintrack mobile — App navigator
// File: src/navigation/AppNavigator.js
// Version: 1.0 — 2026-04-20
// ============================================================

import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useColorScheme, Text } from 'react-native'
import DashboardScreen    from '../screens/DashboardScreen'
import TransactionsScreen from '../screens/TransactionsScreen'

const Tab = createBottomTabNavigator()

function TabIcon({ label, focused }) {
  const icons = { Dashboard: '📊', Transactions: '📋' }
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.5 }}>
      {icons[label] || '●'}
    </Text>
  )
}

export default function AppNavigator() {
  const scheme = useColorScheme()
  const dark   = scheme === 'dark'

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
        tabBarActiveTintColor:   '#2563EB',
        tabBarInactiveTintColor: dark ? '#6B7280' : '#9CA3AF',
        tabBarStyle: {
          backgroundColor: dark ? '#1F2937' : '#FFFFFF',
          borderTopColor:  dark ? '#374151' : '#E5E7EB',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      })}
    >
      <Tab.Screen name="Dashboard"    component={DashboardScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
    </Tab.Navigator>
  )
}
