import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { adminApiService, AuthUser } from '../services/api'

type User = AuthUser

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<User>
  logout: (reason?: 'inactivity') => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

// Client-side login lockout: throttles repeated failed attempts made through this UI.
// This is a usability/defense-in-depth measure, not a substitute for server-side rate limiting —
// anyone calling the API directly bypasses it.
const LOGIN_ATTEMPTS_KEY = 'loginAttempts'
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_LOCKOUT_MS = 60_000

interface AttemptState {
  count: number
  lockedUntil: number
}

function readLoginAttempts(): Record<string, AttemptState> {
  try {
    return JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function writeLoginAttempts(attempts: Record<string, AttemptState>) {
  try {
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts))
  } catch { /* storage unavailable: lockout just won't persist across reloads */ }
}

// Staff are logged out automatically after this long with no mouse/keyboard/touch activity
const INACTIVITY_LIMIT_MS = 20 * 60_000

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const idleTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    // Check for existing auth token on mount
    const token = localStorage.getItem('adminToken')

    if (token) {
      // Validate token with the server
      adminApiService.getCurrentUser()
        .then((userData: User) => {
          setUser(userData)
        })
        .catch(() => {
          // Token is invalid, remove it
          localStorage.removeItem('adminToken')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const logout = (reason?: 'inactivity') => {
    if (reason) {
      try { sessionStorage.setItem('logoutReason', reason) } catch { /* ignore */ }
    }
    setUser(null)
    void adminApiService.logout()
  }

  const login = async (username: string, password: string) => {
    const key = username.trim().toLowerCase()
    const attempts = readLoginAttempts()
    const entry = attempts[key]

    if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
      const seconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000)
      throw new Error(`Too many failed attempts. Try again in ${seconds}s.`)
    }

    try {
      const response = await adminApiService.login(username, password)
      delete attempts[key]
      writeLoginAttempts(attempts)
      const loggedInUser = response.user
      setUser(loggedInUser)
      return loggedInUser
    } catch (error) {
      // Network hiccups shouldn't count against the user, only real credential failures
      const message = error instanceof Error ? error.message : ''
      const isTransient = message.includes('Network error') || message.includes('Request timeout')
      if (!isTransient) {
        const count = (entry?.count ?? 0) + 1
        attempts[key] = { count, lockedUntil: count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOGIN_LOCKOUT_MS : 0 }
        writeLoginAttempts(attempts)
      }
      throw error
    }
  }

  // Auto-logout after a period of no activity, while a session is active
  useEffect(() => {
    if (!user) return

    const resetTimer = () => {
      window.clearTimeout(idleTimer.current)
      idleTimer.current = window.setTimeout(() => logout('inactivity'), INACTIVITY_LIMIT_MS)
    }

    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      window.clearTimeout(idleTimer.current)
      events.forEach(e => window.removeEventListener(e, resetTimer))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!user])

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
