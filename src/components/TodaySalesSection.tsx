import { useNavigate } from 'react-router-dom'
import { adminApiService } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { reportKey } from '../services/queryKeys'
import { daysAgo } from '../utils/dateRange'
import { Receipt } from 'lucide-react'

const num = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// A tile in the same grid and style as the module tiles above it, but live: same data as the
// Transactions report, filtered to today. Clicking it opens the full report.
const TodaySalesSection: React.FC = () => {
  const navigate = useNavigate()
  const today = daysAgo(0)

  const { data, loading } = useCachedQuery(
    reportKey('today-sales', { today }),
    () => adminApiService.getReportBreakdown({ from: today, to: today, groupBy: 'Day' })
  )

  const rows = data ?? []
  const sales = rows.reduce((a, r) => a + r.transactionCount, 0)
  const netSales = rows.reduce((a, r) => a + r.netSales, 0)

  return (
    <div
      onClick={() => navigate(`/restaurant/reports/transactions?${new URLSearchParams({ from: today, to: today })}`)}
      className="relative bg-white rounded-lg shadow transition-all duration-300 group overflow-hidden border-2 transform hover:shadow-xl cursor-pointer hover:-translate-y-1 border-blue-200 hover:border-blue-300"
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') navigate(`/restaurant/reports/transactions?${new URLSearchParams({ from: today, to: today })}`) }}
    >
      <div className="absolute inset-0 bg-blue-500 opacity-15 group-hover:opacity-25 transition-opacity duration-300"></div>
      <div className="relative p-2 flex flex-col items-center justify-center min-h-[84px]">
        <div className="bg-blue-500 p-2 rounded-lg mb-1 group-hover:scale-110 transition-transform duration-300 shadow-lg">
          <Receipt className="h-3.5 w-3.5 text-white" />
        </div>
        <h3 className="text-[9px] font-bold text-gray-900 text-center leading-tight">Today's sales</h3>
        <span className="text-[8px] text-gray-500">{loading ? '…' : `${sales} sale${sales === 1 ? '' : 's'} · ${num(netSales)}`}</span>
      </div>
    </div>
  )
}

export default TodaySalesSection
