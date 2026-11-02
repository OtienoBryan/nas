import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  UtensilsCrossed,
  Package,
  Clock,
  BarChart3,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface NavItem {
  name: string
  icon: React.ComponentType<{ className?: string }>
  route: string
  // Also highlight the item on these sub-pages (e.g. a report opened from the Reports page)
  matchPrefix?: string
}

const navItems: NavItem[] = [
  { name: 'Home', icon: Home, route: '/dashboard' },
  { name: 'Menu Categories', icon: UtensilsCrossed, route: '/restaurant/menu/categories' },
  { name: 'Products', icon: Package, route: '/restaurant/menu/items' },
  { name: 'Staff Shifts', icon: Clock, route: '/restaurant/shifts/staff' },
  { name: 'Reports', icon: BarChart3, route: '/restaurant/reports', matchPrefix: '/restaurant/reports' },
  { name: 'Trips', icon: MapPin, route: '/restaurant/trips' },
]

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  return (
    <div
      className={`flex-shrink-0 bg-[#0b0f24] text-white h-screen sticky top-0 overflow-y-auto no-scrollbar transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-28'
      }`}
    >
      <div className="flex flex-col min-h-full">
        {/* Header / collapse toggle */}
        <div className="flex items-center justify-between px-3 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
          {!collapsed && <span>Shortcuts</span>}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1 rounded-md hover:bg-white/10 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.matchPrefix ? location.pathname.startsWith(item.matchPrefix) : location.pathname === item.route
            return (
              <Link
                key={item.name}
                to={item.route}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 transition-colors ${
                  isActive ? 'bg-brand-red text-white' : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
                title={item.name}
              >
                <Icon className="h-5 w-5" />
                {!collapsed && <span className="text-[10px] font-medium text-center leading-none">{item.name}</span>}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default Sidebar
