import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { adminApiService, AuthUser } from '../services/api'

type User = AuthUser

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => void
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing auth token on mount
    const token = localStorage.getItem('adminToken')
    console.log('🔐 [AuthContext] Checking authentication, token:', token ? 'exists' : 'missing')
    
    if (token) {
      console.log('🔐 [AuthContext] Validating token with server...')
      // Validate token with the server
      adminApiService.getCurrentUser()
        .then((userData: User) => {
          console.log('✅ [AuthContext] Token valid, user data:', userData)
          setUser(userData)
        })
        .catch((error) => {
          console.log('❌ [AuthContext] Token invalid, error:', error)
          // Token is invalid, remove it
          localStorage.removeItem('adminToken')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      console.log('🔐 [AuthContext] No token found')
      setLoading(false)
    }
  }, [])

  const login = async (username: string, password: string) => {
    try {
      console.log('🔐 [AuthContext] Starting login process for:', username)
      const response = await adminApiService.login(username, password)
      console.log('✅ [AuthContext] Login successful, setting user:', response.user)
      const loggedInUser = response.user
      setUser(loggedInUser)
      return loggedInUser
    } catch (error) {
      console.error('❌ [AuthContext] Login failed:', error)
      // Re-throw the error to be handled by the Login component
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    void adminApiService.logout()
  }

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
