// ============================================================
// fintrack — Upgrade / Pricing page
// File: src/pages/Upgrade.jsx
// Version: 1.0 — 2026-04-29
// ============================================================

import React from 'react'
import { useAuth } from '../context/AuthContext'
import { Check, X, Zap } from 'lucide-react'

const TIERS = [
  {
    name:    'Free',
    price:   '$0',
    period:  'forever',
    color:   'gray',
    badge:   null,
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
      { text: 'Live bank feeds',           included: false },
    ],
  },
  {
    name:    'Household',
    price:   '$4.99',
    period:  'per month',
    color:   'blue',
    badge:   'Most Popular',
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
      { text: 'Live bank feeds',           included: false },
    ],
  },
  {
    name:    'Premium',
    price:   '$9.99',
    period:  'per month',
    color:   'purple',
    badge:   'Coming Soon',
    features: [
      { text: 'Everything in Household',   included: true },
      { text: 'Live bank feeds (Plaid)',   included: true },
      { text: 'Unlimited members',         included: true },
      { text: 'API access',                included: true },
      { text: 'Priority support',          included: true },
      { text: 'CSV import',                included: true },
      { text: 'Full analytics',            included: true },
      { text: 'Budget alerts',             included: true },
      { text: 'PDF & Excel export',        included: true },
      { text: 'Multi-factor auth (MFA)',   included: true },
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-10">
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
          No ads, no data selling — ever.
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TIERS.map(tier => {
          const c = colorMap[tier.color]
          const isHighlight = tier.color === 'blue'
          const isCurrent = tier.name.toLowerCase() === plan

          return (
            <div key={tier.name}
                 className={`relative rounded-2xl border-2 ${c.border}
                   ${isHighlight ? 'bg-blue-600 text-white shadow-xl scale-105'
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
                    {tier.price}
                  </span>
                  <span className={`text-sm
                    ${isHighlight ? 'text-blue-100' : 'text-gray-400'}`}>
                    /{tier.period}
                  </span>
                </div>
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
                disabled={isCurrent || tier.badge === 'Coming Soon'}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm
                  transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                  ${isHighlight
                    ? 'bg-white text-blue-700 hover:bg-blue-50'
                    : `${c.btn} text-white`
                  }`}
                onClick={() => {
                  if (!isCurrent && tier.badge !== 'Coming Soon') {
                    window.location.href =
                      `mailto:support@fintrack.app?subject=Upgrade to ${tier.name} plan`
                  }
                }}
              >
                {isCurrent
                  ? '✓ Current plan'
                  : tier.badge === 'Coming Soon'
                  ? 'Coming soon'
                  : `Get ${tier.name}`
                }
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-gray-400 mt-8">
        All plans include end-to-end encryption. Your data is never sold or shared.
        Upgrade and downgrade anytime. · Contact
        <a href="mailto:support@fintrack.app"
           className="text-blue-500 hover:underline mx-1">
          support@fintrack.app
        </a>
        to change your plan.
      </p>
    </div>
  )
}
