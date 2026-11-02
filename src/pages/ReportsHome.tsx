import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BarChart3, Banknote, Package, PieChart, Wallet, Clock, Receipt, Search } from 'lucide-react'

interface ReportLink {
  title: string
  description: string
  route: string
  icon: React.ComponentType<{ className?: string }>
}

interface ReportGroup {
  title: string
  blurb: string
  reports: ReportLink[]
}

const GROUPS: ReportGroup[] = [
  {
    title: 'Sales',
    blurb: 'What was sold, by whom and when',
    reports: [
      { title: 'Summary', description: 'Sales, collections, shifts and open exceptions', route: '/restaurant/reports/summary', icon: BarChart3 },
      { title: 'Sales breakdown', description: 'Sales by day, trip, staff, item or payment method', route: '/restaurant/reports/breakdown', icon: PieChart },
      { title: 'Product sales', description: 'Quantity sold and value per product, this month by default', route: '/restaurant/reports/products', icon: Package },
      { title: 'Sales', description: 'Every sale with receipt, staff, status and payment', route: '/restaurant/reports/transactions', icon: Receipt },
    ],
  },
  {
    title: 'Money',
    blurb: 'Collections and how they were paid',
    reports: [
      { title: 'Cash collections', description: 'Expected vs declared collections', route: '/restaurant/reports/collections', icon: Wallet },
      { title: 'Payments summary', description: 'Collections by payment method for each date', route: '/restaurant/collections', icon: Banknote },
    ],
  },
  {
    title: 'Operations',
    blurb: 'Shifts',
    reports: [
      { title: 'Shifts', description: 'All shifts with sales, expected and declared totals', route: '/restaurant/shifts/staff', icon: Clock },
    ],
  },
]

const ReportsHome: React.FC = () => {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return GROUPS
    return GROUPS
      .map(g => ({ ...g, reports: g.reports.filter(r => `${r.title} ${r.description}`.toLowerCase().includes(term)) }))
      .filter(g => g.reports.length > 0)
  }, [q])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Back">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Reports</h1>
          <p className="text-[11px] text-gray-500">Pick a report to open</p>
        </div>
        <div className="flex-1" />
        <div className="relative w-56 max-w-full">
          <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Find a report"
            className="w-full border border-gray-300 rounded-lg pl-8 pr-2 py-1.5 text-xs text-gray-700 bg-white"
          />
        </div>
      </div>

      {groups.length === 0 && <div className="text-center text-xs text-gray-400 py-10">No report matches “{q}”.</div>}

      {groups.map(g => (
        <section key={g.title} className="space-y-2.5">
          <div className="flex items-baseline gap-2 border-b border-gray-200 pb-1.5">
            <h2 className="text-sm font-bold text-green-800">{g.title}</h2>
            <span className="text-[11px] text-gray-500">{g.blurb}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {g.reports.map(r => {
              const Icon = r.icon
              return (
                <button
                  key={r.title}
                  onClick={() => navigate(r.route)}
                  className="group relative flex items-center gap-3.5 text-left bg-white rounded-xl border border-gray-100 shadow-sm pl-5 pr-4 py-4 overflow-hidden hover:shadow-md hover:border-gray-200 transition-all"
                >
                  <span className="absolute left-0 inset-y-0 w-1 bg-green-700 group-hover:bg-brand-red transition-colors" />
                  <div className="bg-green-50 p-2.5 rounded-lg group-hover:bg-red-50 transition-colors">
                    <Icon className="h-5 w-5 text-green-700 group-hover:text-brand-red transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900">{r.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-brand-red group-hover:translate-x-0.5 transition-all" />
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export default ReportsHome
