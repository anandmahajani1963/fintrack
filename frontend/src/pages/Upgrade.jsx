// ============================================================
// fintrack — Upgrade / Pricing page
// File: src/pages/Upgrade.jsx
// Version: 2.0 — 2026-07-14
// Changes:
//   v1.0  2026-04-29  Initial pricing page
//   v2.0  2026-07-14  Stripe Checkout integration with monthly/annual toggle
// ============================================================

import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Check, X, Zap, CreditCard, Settings } from 'lucide-react'

const TIERS = [
  {
    name:    'Free',
    plan:    'free',
    monthly: 0,
    annual:  0,
    color:   'gray',
    badge:   null,
    priceKeys: {},
    features: [
      { text: '1 household member',        included: true },
      { text: '1 credit/debit card',       included: true },
      { text: '12 months history',         included: true },
      { text: 'CSV import',                included: true },
      { text: 'Basic analytics',           included: true },
      { text: 'Budget alerts',             included: false },
      { text: 'PDF & Excel export',        included: false },
      { text: 'Multi-factor auth (MFA)',   included: false },
      { text: 'Unlimited cards & history', included: false },
    ],
  },
  {
    name:    'Household',
    plan:    'household',
    monthly: 4.99,
    annual:  49.90,
    color:   'blue',
    badge:   'Most Popular',
    priceKeys: { monthly: 'household_monthly', annual: 'household_annual' },
    features: [
      { text: '2 household members',       included: true },
      { text: 'Unlimited cards',           included: true },
      { text: 'Unlimited history',         included: true },
      { text: 'CSV import',                included: true },
      { text: 'Full analytics',            included: true },
      { text: 'Budget alerts',             included: true },
      { text: 'PDF & Excel export',        included: true },
      { text: 'Multi-factor auth (MFA)',   included: true },
      { text: 'Unlimited cards & history', included: true },
    ],
  },
  {
    name:    'Premium',
    plan:    'premium',
    monthly: 9.99,
    annual:  99.90,
    color:   'purple',
    badge:   'Coming Soon',
    priceKeys: { monthly: 'premium_monthly', annual: 'premium_annual' },
    features: [
      { text: 'Everything in Household',   included: true },
      { text: 'Live bank feeds (Plaid)',   included: true },
      { text: 'Unlimited members',         included: true },
      { text: 'API access',                included: true },
      { text: 'Priority support',          included: true },
    ],
  },
]

const colorMap = {
  gray:   { bg: 'bg-gray-50 dark:bg-gray-800',
            border: 'border-gray-200 dark:border-gray-700',
            btn: 'bg-gray-600 hover:bg-gray-700',
            badge: 'bg-gray-100 text-gray-600' },
  blue:   { bg: 'bg-blue-600',
            border: 'border-blue-600',
            btn: 'bg-white hover:bg-blue-50 !text-blue-700',
            badge: 'bg-blue-100 text-blue-700' },
  purple: { bg: 'bg-gray-50 dark:bg-gray-800',
            border: 'border-purple-300 dark:border-purple-700',
            btn: 'bg-purple-600 hover:bg-purple-700',
            badge: 'bg-purple-100 text-purple-700' },
}

export default function Upgrade() {
  const { plan } = useAuth()
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')

  async function handleUpgrade(tier) {
    const priceKey = tier.priceKeys[billingCycle]
    if (!priceKey) return

    setLoading(tier.plan)
    setError('')

    try {
      const token = sessionStorage.getItem('access_token')
        || document.cookie.match(/access_token=([^;]+)/)?.[1]

      // Get a fresh token via refresh
      const refreshRes = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: sessionStorage.getItem('refresh_token') || ''
        })
      })
      if (!refreshRes.ok) throw new Error('Session expired. Please log in again.')
      const refreshData = await refreshRes.json()

      const res = await fetch('/api/v1/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshData.access_token}`,
        },
        body: JSON.stringify({ price_key: priceKey }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to create checkout session')
      }

      const { checkout_url } = await res.json()
      window.location.href = checkout_url
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading('')
    }
  }

  async function handleManageSubscription() {
    setLoading('manage')
    setError('')
    try {
      const refreshRes = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: sessionStorage.getItem('refresh_token') || ''
        })
      })
      if (!refreshRes.ok) throw new Error('Session expired. Please log in again.')
      const refreshData = await refreshRes.json()

      const res = await fetch('/api/v1/stripe/customer-portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshData.access_token}`,
        },
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to open billing portal')
      }
      const { portal_url } = await res.json()
      window.location.href = portal_url
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20
                        text-blue-700 dark:text-blue-300 px-4 py-1.5 rounded-full
                        text-sm font-medium mb-4">
          <Zap size={14} />
          Simple, transparent pricing
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Choose your plan
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
          fintrack keeps your financial data private and encrypted.
          No ads, no data selling — ever. Start with a 14-day free trial.
        </p>
      </div>

      {/* Billing cycle toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${billingCycle === 'monthly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${billingCycle === 'annual'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400'}`}
          >
            Annual
            <span className="ml-1.5 text-xs text-green-600 dark:text-green-400 font-semibold">
              Save 2 months
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20
                        text-red-600 dark:text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TIERS.map(tier => {
          const c = colorMap[tier.color]
          const isHighlight = tier.color === 'blue'
          const isCurrent = tier.plan === plan
          const price = billingCycle === 'annual' ? tier.annual : tier.monthly
          const period = tier.monthly === 0 ? 'forever'
            : billingCycle === 'annual' ? 'per year' : 'per month'

          return (
            <div key={tier.name}
                 className={`relative rounded-2xl border-2 ${c.border}
                   ${isHighlight ? 'bg-blue-600 text-white shadow-xl md:scale-105'
                                 : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'}
                   p-6 flex flex-col`}>

              {/* Badge */}
              {tier.badge && (
                <span className={`absolute -top-3 left-1/2 -translate-x-1/2
                  text-xs font-bold px-3 py-1 rounded-full
                  ${isHighlight ? 'bg-white text-blue-600' : c.badge}`}>
                  {tier.badge}
                </span>
              )}

              {/* Current plan indicator */}
              {isCurrent && (
                <span className="absolute -top-3 right-4 text-xs font-bold
                  px-3 py-1 rounded-full bg-green-100 text-green-700">
                  Current plan
                </span>
              )}

              {/* Name & price */}
              <div className="mb-6">
                <h2 className={`text-xl font-bold mb-1
                  ${isHighlight ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {tier.name}
                </h2>
                <div className="flex items-baseline gap-1">
                  <span className={`text-4xl font-bold
                    ${isHighlight ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                    ${price.toFixed(2)}
                  </span>
                  <span className={`text-sm
                    ${isHighlight ? 'text-blue-100' : 'text-gray-400'}`}>
                    /{period}
                  </span>
                </div>
                {tier.monthly > 0 && (
                  <p className={`text-xs mt-1
                    ${isHighlight ? 'text-blue-200' : 'text-green-600 dark:text-green-400'}`}>
                    14-day free trial included
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-8 flex-1">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    {f.included
                      ? <Check size={15} className={isHighlight
                          ? 'text-blue-200' : 'text-green-500'} />
                      : <X size={15} className={isHighlight
                          ? 'text-blue-300 opacity-50' : 'text-gray-300'} />
                    }
                    <span className={`text-sm
                      ${!f.included
                        ? isHighlight ? 'text-blue-200 opacity-60' : 'text-gray-300'
                        : isHighlight ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA button */}
              <button
                disabled={isCurrent || tier.badge === 'Coming Soon' || loading === tier.plan}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                  ${isHighlight
                    ? 'bg-white text-blue-700 hover:bg-blue-50'
                    : `${c.btn} text-white`
                  }`}
                onClick={() => handleUpgrade(tier)}
              >
                {loading === tier.plan ? (
                  <>Processing...</>
                ) : isCurrent ? (
                  '✓ Current plan'
                ) : tier.badge === 'Coming Soon' ? (
                  'Coming soon'
                ) : (
                  <><CreditCard size={15} /> Get {tier.name}</>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Manage subscription link */}
      {plan !== 'free' && (
        <div className="text-center mt-6">
          <button
            onClick={handleManageSubscription}
            disabled={loading === 'manage'}
            className="inline-flex items-center gap-2 text-sm text-blue-600
                       dark:text-blue-400 hover:underline disabled:opacity-50"
          >
            <Settings size={14} />
            {loading === 'manage' ? 'Opening...' : 'Manage subscription & billing'}
          </button>
        </div>
      )}

      {/* Footer note */}
      <p className="text-center text-xs text-gray-400 mt-8">
        All plans include end-to-end encryption. Your data is never sold or shared.
        14-day free trial on all paid plans. Cancel anytime. · Contact
        <a href="mailto:nudgelabsllc@gmail.com"
           className="text-blue-500 hover:underline mx-1">
          nudgelabsllc@gmail.com
        </a>
        for support.
      </p>
    </div>
  )
}
