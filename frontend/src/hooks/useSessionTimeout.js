// ============================================================
// fintrack — Session timeout hook
// File: src/hooks/useSessionTimeout.js
// Version: 1.2 — 2026-04-24 — 1777060549
// ============================================================

import { useEffect, useRef, useState } from 'react'

// Session timeout configuration
const TIMEOUT_MS = parseInt(import.meta.env.VITE_TIMEOUT_MS || "1800000")
const WARN_MS    = parseInt(import.meta.env.VITE_WARN_MS    || "60000")

export function useSessionTimeout(isLoggedIn, onLogout) {
  const [showWarn, setShowWarn]     = useState(false)
  const [countdown, setCountdown]   = useState(60)

  // Use refs so event handlers always have fresh values
  const logoutRef    = useRef(onLogout)
  const showWarnRef  = useRef(showWarn)
  const warnTimer    = useRef(null)
  const logoutTimer  = useRef(null)
  const countTimer   = useRef(null)
  const lastActivity = useRef(Date.now())

  logoutRef.current   = onLogout
  showWarnRef.current = showWarn

  useEffect(() => {
    if (!isLoggedIn) {
      setShowWarn(false)
      return
    }

    function clearAll() {
      clearTimeout(warnTimer.current)
      clearTimeout(logoutTimer.current)
      clearInterval(countTimer.current)
    }

    function startTimers() {
      clearAll()
      setShowWarn(false)

      warnTimer.current = setTimeout(() => {
        setShowWarn(true)
        setCountdown(60)
        let c = 60
        countTimer.current = setInterval(() => {
          c -= 1
          setCountdown(c)
          if (c <= 0) clearInterval(countTimer.current)
        }, 1000)
      }, TIMEOUT_MS - WARN_MS)

      logoutTimer.current = setTimeout(() => {
        setShowWarn(false)
        logoutRef.current()
      }, TIMEOUT_MS)
    }

    function handleActivity() {
      const now = Date.now()
      if (now - lastActivity.current < 5000) return  // throttle to 5s
      if (showWarnRef.current) return  // don't reset during warning
      lastActivity.current = now
      startTimers()
    }

    startTimers()

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove']
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))

    return () => {
      clearAll()
      events.forEach(e => window.removeEventListener(e, handleActivity))
    }
  }, [isLoggedIn])  // ONLY re-run when isLoggedIn changes

  function stayLoggedIn() {
    setShowWarn(false)
    clearTimeout(warnTimer.current)
    clearTimeout(logoutTimer.current)
    clearInterval(countTimer.current)
    lastActivity.current = Date.now()
    // Restart timers
    warnTimer.current = setTimeout(() => {
      setShowWarn(true)
      setCountdown(10)
      let c = 10
      countTimer.current = setInterval(() => {
        c -= 1
        setCountdown(c)
        if (c <= 0) clearInterval(countTimer.current)
      }, 1000)
    }, TIMEOUT_MS - WARN_MS)
    logoutTimer.current = setTimeout(() => {
      setShowWarn(false)
      logoutRef.current()
    }, TIMEOUT_MS)
  }

  return { showWarn, countdown, stayLoggedIn }
}
