import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useInactivity } from '../hooks/useInactivity'
import Screensaver from './Screensaver'
import Sidebar from './Sidebar'
import { startAuditTracking } from '../services/audit'
import { LogOut, Settings } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [screensaverActive, setScreensaverActive] = useState(false)
  const { user, logout } = useAuth()

  // Audit trail: record button clicks and post queued events to the audit endpoint
  useEffect(() => startAuditTracking(), [])

  // Track inactivity - show screensaver after 20 minutes
  useInactivity({
    timeout: 20 * 60 * 1000, // 20 minutes
    onInactive: () => {
      console.log('Screensaver activated - user inactive')
      setScreensaverActive(true)
    },
    onActive: () => {
      console.log('Screensaver deactivated - user active')
      setScreensaverActive(false)
    }
  })

  const handleDismissScreensaver = () => {
    setScreensaverActive(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex h-16 flex-shrink-0 overflow-hidden bg-white shadow">
          <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center px-4">
            <div />
            <img src="/nas.png" alt="NAS Servair" className="-my-6 h-28 w-auto object-contain" />
            <div className="flex items-center justify-end space-x-3">
              <div className="text-sm text-gray-600">
                {user?.fullName}
              </div>
              <button className="text-gray-400 hover:text-gray-500">
                <Settings className="h-4 w-4" />
              </button>
              <button
                onClick={logout}
                className="text-gray-400 hover:text-gray-500"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-4">
            <div className="mx-auto w-full px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* Screensaver */}
      <Screensaver isActive={screensaverActive} onDismiss={handleDismissScreensaver} />
    </div>
  )
}

export default Layout
