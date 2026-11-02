import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { adminApiService, ReportFilters } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { reportKey, saleKey, tripsKey } from '../services/queryKeys'
import { prefetchQuery } from '../services/queryCache'
import Pagination from '../components/ui/Pagination'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

const num = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-3 py-2 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>
)

// Sales behind one row of the sales breakdown. The row and the report's filters arrive in the URL:
// ?groupBy=Day&key=2026-10-28&label=...&from=...&to=...&staffId=...
const BreakdownSales: React.FC = () => {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const groupBy = sp.get('groupBy') ?? ''
  const key = sp.get('key') ?? ''
  const label = sp.get('label') ?? key
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Narrow the report's filters down to this row
  const f: ReportFilters = { from: sp.get('from') ?? '', to: sp.get('to') ?? '', staffId: sp.get('staffId') ?? '', page, pageSize }
  if (groupBy === 'Day') { f.from = key; f.to = key }
  else if (groupBy === 'Staff') f.staffId = key
  else if (groupBy === 'Method') f.methodCode = key
  else if (groupBy === 'Trip') f.serviceNumber = key

  const valid = !!f.from && !!f.to && !!key && ['Day', 'Staff', 'Method', 'Trip'].includes(groupBy)
  const { data, loading, refreshing, error, refetch } = useCachedQuery(reportKey('breakdown-sales', f), () =>
    valid ? adminApiService.getReportTransactions(f) : Promise.resolve({ items: [], total: 0 })
  )
  const items = data?.items ?? []
  const total = data?.total ?? 0

  // Trip names come from the trips list (type + service number, route or origin/destination);
  // sales only carry the service number and route, which is the fallback.
  const tripQuery = { from: '2000-01-01', to: '2099-12-31', page: 1, pageSize: 200 }
  const trips = useCachedQuery(tripsKey(tripQuery), () => adminApiService.getTripsPage(tripQuery))
  const tripFor = useMemo(() => {
    const list = trips.data?.items ?? []
    return (serviceNumber: string | null, saleDay: string) => {
      if (!serviceNumber) return undefined
      const same = list.filter(x => x.serviceNumber === serviceNumber)
      return same.find(x => x.serviceDate?.slice(0, 10) === saleDay) ?? (same.length === 1 ? same[0] : undefined)
    }
  }, [trips.data])
  const tripName = (t: (typeof items)[number]) => {
    const trip = tripFor(t.serviceNumber, (t.occurredAtUtc ?? '').slice(0, 10))
    const name = trip ? `${trip.serviceType} ${trip.serviceNumber}` : t.serviceNumber ? `Service ${t.serviceNumber}` : ''
    const detail = trip?.route || t.route || (trip?.origin || trip?.destination ? `${trip?.origin || '—'} → ${trip?.destination || '—'}` : '')
    return { name, detail }
  }
  const sum = items.reduce((a, t) => a + t.total, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/restaurant/reports/breakdown'))} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Back">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Sales · {label}</h1>
          <p className="text-xs text-gray-500">
            {groupBy}: {label}{groupBy !== 'Day' && f.from ? ` · ${f.from} to ${f.to}` : ''} · {total} sale{total === 1 ? '' : 's'}
            {total > 0 && total <= pageSize ? ` · ${num(sum)} total` : ''}
          </p>
        </div>
        <div className="flex-1" />
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!valid && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-4 py-2">Open this page from a row in the sales breakdown.</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr><Th>Receipt</Th><Th>Sale time</Th><Th>Staff</Th><Th>Trip</Th><Th>Seat / table</Th><Th right>Items</Th><Th right>Total</Th><Th right>Refunded</Th><Th>Status</Th><Th>Methods</Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">{loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'No sales found.'}</td></tr>
              ) : items.map(t => (
                <tr
                  key={t.saleId}
                  onClick={() => navigate(`/restaurant/sales/${t.saleId}`)}
                  onMouseEnter={() => prefetchQuery(saleKey(t.saleId), () => adminApiService.getRestaurantSale(t.saleId))}
                  className="hover:bg-blue-50 cursor-pointer"
                  title="Click to open the sale"
                >
                  <td className="px-3 py-2"><div className="font-medium text-gray-900">{t.receiptNumber}</div><div className="text-[10px] text-gray-400">{t.saleReference}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap">{when(t.occurredAtUtc)}{t.capturedOffline && <span className="ml-1 text-[10px] text-gray-400">offline</span>}</td>
                  <td className="px-3 py-2">{t.staffName}<div className="text-[10px] text-gray-400">#{t.staffNumber}</div></td>
                  <td className="px-3 py-2">
                    {(() => {
                      const { name, detail } = tripName(t)
                      return name || detail ? (
                        <>
                          <div className="font-medium text-gray-900">{name || detail}</div>
                          {name && detail && <div className="text-[10px] text-gray-500">{detail}</div>}
                        </>
                      ) : '—'
                    })()}
                  </td>
                  <td className="px-3 py-2">{t.seatNumber || t.tableNumber || '—'}</td>
                  <td className="px-3 py-2 text-right">{t.itemCount}</td>
                  <td className="px-3 py-2 text-right font-semibold">{num(t.total)}</td>
                  <td className="px-3 py-2 text-right">{num(t.refundedAmount)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.status === 'Completed' ? 'bg-green-100 text-green-700' : t.status === 'Voided' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{t.status}</span>
                    {t.requiresReview && <span title="Flagged for review" className="ml-1 text-amber-600">⚠</span>}
                  </td>
                  <td className="px-3 py-2">{t.paymentMethods || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          totalPages={Math.max(1, Math.ceil(total / pageSize))}
          totalItems={total}
          itemsPerPage={pageSize}
          onPageChange={setPage}
          onItemsPerPageChange={n => { setPageSize(n); setPage(1) }}
        />
      </div>
    </div>
  )
}

export default BreakdownSales
