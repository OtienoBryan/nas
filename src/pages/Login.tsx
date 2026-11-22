import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Lock, Mail, AlertCircle, CheckCircle, Info } from 'lucide-react'

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [info, setInfo] = useState(() => {
    try {
      if (sessionStorage.getItem('logoutReason') === 'inactivity') {
        sessionStorage.removeItem('logoutReason')
        return 'You were signed out after a period of inactivity.'
      }
    } catch { /* ignore */ }
    return ''
  })
  const [retryCount, setRetryCount] = useState(0)
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const submitTimeoutRef = useRef<number | null>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    // Clear error when user starts typing
    if (error) {
      setError('')
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }, [error])

  const validateForm = useCallback(() => {
    const { username, password } = formData
    
    if (!username.trim()) {
      setError('Username is required')
      return false
    }
    
    if (!password.trim()) {
      setError('Password is required')
      return false
    }
    
    
    return true
  }, [formData])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Prevent multiple submissions
    if (loading) {
      return
    }
    
    // Clear previous messages
    setError('')
    setSuccess('')
    
    // Validate form
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    
    // Clear any existing timeout
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current)
    }
    
    // Set a maximum loading time
    submitTimeoutRef.current = setTimeout(() => {
      setLoading(false)
      setError('Login is taking longer than expected. Please try again.')
    }, 30000) // 30 second timeout

    try {
      const loggedInUser = await login(formData.username, formData.password)
      setSuccess('Login successful! Redirecting...')
      setRetryCount(0)
      // Executives land on their own overview; everyone else goes to the normal dashboard
      const destination = loggedInUser.role?.toLowerCase() === 'executive' ? '/executive-dashboard' : '/dashboard'
      setTimeout(() => {
        navigate(destination, { replace: true })
      }, 1000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      setError(errorMessage)
      
      // Track retry attempts for network errors
      if (errorMessage.includes('Network error') || errorMessage.includes('Request timeout')) {
        setRetryCount(prev => prev + 1)
      } else {
        setRetryCount(0)
      }
    } finally {
      setLoading(false)
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current)
      }
    }
  }, [formData, loading, login, validateForm, error])

  // Cleanup timeout on unmount
  const handleCleanup = useCallback(() => {
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current)
    }
  }, [])

  // Auto-retry for network errors
  const handleRetry = useCallback(() => {
    if (retryCount > 0 && retryCount < 3) {
      handleSubmit({ preventDefault: () => {} } as React.FormEvent)
    }
  }, [retryCount, handleSubmit])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const destination = user?.role?.toLowerCase() === 'executive' ? '/executive-dashboard' : '/dashboard'
      navigate(destination, { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      handleCleanup()
    }
  }, [handleCleanup])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100" style={{ background: 'linear-gradient(to bottom right, rgba(39, 41, 117, 0.05), rgba(211, 4, 65, 0.08))' }}>
      <div className="max-w-md w-full space-y-2 p-4">
        <div className="admin-card rounded-xl shadow-2xl p-8 min-h-[400px] flex flex-col">
          <div className="text-center flex-shrink-0">
            {/* Logo */}
            <div className="mx-auto mb-2">
              <img 
                src="/nas.png" 
                alt="NAS Servair Logo" 
                className="h-32 w-auto mx-auto"
              />
            </div>
          
          </div>
          
          <form className="mt-6 space-y-5 flex-1 flex flex-col justify-center" onSubmit={handleSubmit}>
            {/* Inactivity sign-out notice */}
            {info && !error && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg flex items-center space-x-2">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <p className="text-sm font-medium">{info}</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{error}</p>
                  {retryCount > 0 && retryCount < 3 && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="text-[10px] text-red-600 underline hover:text-red-800 mt-0.5"
                    >
                      Retry connection ({retryCount}/3)
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                <p className="text-sm font-medium">{success}</p>
              </div>
            )}
            
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-gray-700 mb-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  disabled={loading}
                  className={`admin-input w-full pl-10 pr-3 py-2.5 text-sm rounded-lg focus:outline-none transition-colors ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="username"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  disabled={loading}
                  className={`admin-input w-full pl-10 pr-3 py-2.5 text-sm rounded-lg focus:outline-none transition-colors ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading || !formData.username.trim() || !formData.password.trim()}
              className="admin-button w-full py-2.5 px-3 rounded-lg text-white text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-[#272975] disabled:opacity-80 disabled:cursor-not-allowed transition-all duration-200 hover:enabled:shadow-lg mt-4"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-1">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
 
        </div>
      </div>
    </div>
  )
}

export default Login
