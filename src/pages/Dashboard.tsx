import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { adminApiService } from '../services/api'
import { prefetchQuery } from '../services/queryCache'
import { MENU_CATEGORIES_KEY } from '../services/queryKeys'
import DailySalesSection from '../components/DailySalesSection'
import ProductPerformanceSection from '../components/ProductPerformanceSection'
import { RESTAURANT_MODULES } from '../services/restaurantModules'
import {
  UtensilsCrossed,
  Package,
  ShoppingCart,
  Clock,
  CreditCard,
  Wallet,
  BarChart3,
  UserCheck,
  Smartphone,
  MapPin,
  RefreshCw,
  Landmark,
  ShieldCheck,
  Activity,
} from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  UtensilsCrossed, Package, ShoppingCart, Clock, CreditCard, Wallet, BarChart3,
  UserCheck, Smartphone, MapPin, RefreshCw, Landmark, ShieldCheck, Activity,
}

// Static class names so Tailwind can see them
const TILE_COLORS: Record<string, { bg: string; border: string }> = {
  orange: { bg: 'bg-orange-500', border: 'border-orange-200 hover:border-orange-300' },
  emerald: { bg: 'bg-emerald-500', border: 'border-emerald-200 hover:border-emerald-300' },
  blue: { bg: 'bg-blue-500', border: 'border-blue-200 hover:border-blue-300' },
  amber: { bg: 'bg-amber-500', border: 'border-amber-200 hover:border-amber-300' },
  teal: { bg: 'bg-teal-500', border: 'border-teal-200 hover:border-teal-300' },
  pink: { bg: 'bg-pink-500', border: 'border-pink-200 hover:border-pink-300' },
  indigo: { bg: 'bg-indigo-500', border: 'border-indigo-200 hover:border-indigo-300' },
  cyan: { bg: 'bg-cyan-500', border: 'border-cyan-200 hover:border-cyan-300' },
  lime: { bg: 'bg-lime-500', border: 'border-lime-200 hover:border-lime-300' },
  purple: { bg: 'bg-purple-500', border: 'border-purple-200 hover:border-purple-300' },
  red: { bg: 'bg-red-500', border: 'border-red-200 hover:border-red-300' },
  slate: { bg: 'bg-slate-500', border: 'border-slate-200 hover:border-slate-300' },
  green: { bg: 'bg-green-500', border: 'border-green-200 hover:border-green-300' },
}

interface Tile {
  key: string
  name: string
  icon: string
  color: string
  route: string
  sub: string
}

// Direct links to dedicated pages, shown ahead of the module tiles
const PAGE_TILES: Tile[] = [
  { key: 'menu-categories', name: 'Menu Categories', icon: 'UtensilsCrossed', color: 'orange', route: '/restaurant/menu/categories', sub: 'Manage' },
  { key: 'menu-items', name: 'Products', icon: 'Package', color: 'amber', route: '/restaurant/menu/items', sub: 'Manage' },
  { key: 'staff-shifts', name: 'Staff Shifts', icon: 'Clock', color: 'blue', route: '/restaurant/shifts/staff', sub: 'View' },
]

// Modules with no card on the dashboard (their pages still work by URL)
const HIDDEN_MODULES = ['menu', 'shifts', 'payments', 'payment-methods', 'dpo', 'audit', 'health', 'devices', 'sync', 'sales']

const TILES: Tile[] = [
  ...PAGE_TILES,
  ...RESTAURANT_MODULES.filter(m => !HIDDEN_MODULES.includes(m.slug)).map(m => ({
    key: m.slug, name: m.name, icon: m.icon, color: m.color,
    route: `/restaurant/${m.slug}`, sub: `${m.endpoints.length} endpoints`,
  })),
]

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  // The executive role has its own dashboard — keep them off this one.
  useEffect(() => {
    if (!authLoading && user && user.role?.toLowerCase() === 'executive') {
      navigate('/executive-dashboard', { replace: true })
    }
  }, [authLoading, user, navigate])

  // Warm the categories cache so that page opens instantly
  useEffect(() => {
    if (!authLoading && user) prefetchQuery(MENU_CATEGORIES_KEY, () => adminApiService.getMenuCategories())
  }, [authLoading, user])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 -m-4 p-6">
      <div className="space-y-6 w-full">
        {/* One button per folder in the Restaurant Connect API collection */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {TILES.map(module => {
            const Icon = ICONS[module.icon] ?? Activity
            const colors = TILE_COLORS[module.color] ?? TILE_COLORS.blue
            return (
              <div
                key={module.key}
                onClick={() => navigate(module.route)}
                className={`relative bg-white rounded-lg shadow transition-all duration-300 group overflow-hidden border-2 transform hover:shadow-xl cursor-pointer hover:-translate-y-1 ${colors.border}`}
              >
                <div className={`absolute inset-0 ${colors.bg} opacity-15 group-hover:opacity-25 transition-opacity duration-300`}></div>
                <div className="relative p-2 flex flex-col items-center justify-center min-h-[84px]">
                  <div className={`${colors.bg} p-2 rounded-lg mb-1 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h3 className="text-[9px] font-bold text-gray-900 text-center leading-tight">{module.name}</h3>
                  <span className="text-[8px] text-gray-500">{module.sub}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Daily sales graph for the selected period (current month by default) */}
        <DailySalesSection />

        {/* Best-selling products for the selected period */}
        <ProductPerformanceSection />
      </div>
    </div>
  )
}

export default Dashboard
