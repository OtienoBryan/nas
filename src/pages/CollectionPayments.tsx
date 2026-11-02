import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { adminApiService, SaleDetail } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { reportKey, saleKey, PAYMENT_METHODS_KEY } from '../services/queryKeys'
import { fetchQuery } from '../services/queryCache'
import Pagination from '../components/ui/Pagination'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

const num = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const MAX_SALES_PER_SHIFT = 200

interface PaymentRow {
  key: string
  saleId: string
  receipt: string
  waiter: string
  shiftLabel: string
  shiftDetail: string
  method: string
  amount: number
  paidAt: string
  status: string
}

// Run async work a few at a time so a busy shift doesn't fire hundreds of requests at once
async function inChunks<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  return out
}

// Payments behind a figure on the collections page. Collections are grouped by the shift's service date, so
// this finds the shifts of that date, then their sales, then each sale's payments.
async function loadPayments(date: string, method: string, from: string, to: string, staffId: string) {
  const [shiftFrom, shiftTo] = date ? [date, date] : [from, to]
  const shifts = (await adminApiService.getShiftReport(shiftFrom, shiftTo, staffId, 1, 100)).items.filter(
    s => (s.serviceDate ?? '').slice(0, 10) >= shiftFrom && (s.serviceDate ?? '').slice(0, 10) <= shiftTo
  )
  const today = new Date().toISOString().slice(0, 10)
  let truncated = false

  const perShift = await inChunks(shifts, 3, async shift => {
    // Sales can be recorded after the service date, so search from the shift start to its end (or today)
    const f = {
      from: shift.startedAtUtc.slice(0, 10),
      to: (shift.endedAtUtc ?? `${today}T00:00:00Z`).slice(0, 10),
      shiftId: shift.shiftId,
      methodCode: method || undefined,
      page: 1,
      pageSize: MAX_SALES_PER_SHIFT,
    }
    const tx = await adminApiService.getReportTransactions(f)
    if (tx.total > tx.items.length) truncated = true
    const sales = await inChunks(tx.items, 8, t =>
      fetchQuery<SaleDetail>(saleKey(t.saleId), () => adminApiService.getRestaurantSale(t.saleId))
    )
    return sales.flatMap(sale =>
      sale.payments
        .filter(p => !method || p.methodCode === method)
        .map<PaymentRow>(p => ({
          key: p.id,
          saleId: sale.id,
          receipt: sale.receiptNumber,
          waiter: sale.staffName,
          shiftLabel: `Service ${shift.serviceNumber ?? '—'}`,
          shiftDetail: `${shift.route ? `${shift.route} · ` : ''}started ${when(shift.startedAtUtc)}`,
          method: p.methodCode,
          amount: p.amount,
          paidAt: p.confirmedAtUtc ?? p.occurredAtUtc,
          status: p.status,
        }))
    )
  })
  const rows = perShift.flat().sort((a, b) => b.paidAt.localeCompare(a.paidAt))
  return { rows, truncated, shiftCount: shifts.length }
}

const STATUS_STYLE: Record<string, string> = {
  Confirmed: 'bg-green-100 text-green-700',
  Pending: 'bg-amber-100 text-amber-700',
  Failed: 'bg-red-100 text-red-700',
}

const CollectionPayments: React.FC = () => {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const date = sp.get('date') ?? ''
  const method = sp.get('method') ?? ''
  const from = sp.get('from') ?? ''
  const to = sp.get('to') ?? ''
  const staffId = sp.get('staffId') ?? ''
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const valid = !!(date || (from && to))
  const { data, loading, refreshing, error, refetch } = useCachedQuery(
    reportKey('collection-payments', { date, method, from, to, staffId }),
    () => (valid ? loadPayments(date, method, from, to, staffId) : Promise.resolve({ rows: [] as PaymentRow[], truncated: false, shiftCount: 0 }))
  )
  const methods = useCachedQuery(PAYMENT_METHODS_KEY, () => adminApiService.getRestaurantPaymentMethods())
  const methodName = (code: string) => methods.data?.find(m => m.code === code)?.name ?? code

  const rows = data?.rows ?? []
  const confirmed = useMemo(() => rows.filter(r => r.status === 'Confirmed').reduce((a, r) => a + r.amount, 0), [rows])
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * pageSize, current * pageSize)

  const title = `${method ? methodName(method) : 'All methods'} · ${date ? dayLabel(date) : `${from} to ${to}`}`

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/restaurant/collections'))} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Back">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Payments · {title}</h1>
          <p className="text-[11px] text-gray-500">
            {data ? `${rows.length} payment${rows.length === 1 ? '' : 's'} from ${data.shiftCount} shift${data.shiftCount === 1 ? '' : 's'} · ` : ''}
            collections are grouped by the shift's service date
          </p>
        </div>
        <div className="flex-1" />
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!valid && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-4 py-2">Open this page by clicking a figure on the payment collections page.</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">{error}</div>}
      {data?.truncated && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-4 py-2">A shift has more than {MAX_SALES_PER_SHIFT} sales, so only the first {MAX_SALES_PER_SHIFT} of it are listed.</div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          ['Payments', String(rows.length)],
          ['Confirmed amount', num(confirmed)],
          ['All amounts', num(rows.reduce((a, r) => a + r.amount, 0))],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3">
            <div className="text-[11px] font-medium text-gray-500">{k}</div>
            <div className="text-base font-bold text-gray-900 mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Waiter</th><th className="px-3 py-2 font-semibold">Shift</th><th className="px-3 py-2 font-semibold">Receipt</th>
                {!method && <th className="px-3 py-2 font-semibold">Method</th>}
                <th className="px-3 py-2 font-semibold text-right">Amount</th><th className="px-3 py-2 font-semibold">Time paid</th><th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No payments found.</td></tr>
              ) : visible.map(r => (
                <tr key={r.key} onClick={() => navigate(`/restaurant/sales/${r.saleId}`)} className="hover:bg-blue-50 cursor-pointer" title="Click to open the sale">
                  <td className="px-3 py-2 font-medium text-gray-900">{r.waiter}</td>
                  <td className="px-3 py-2"><div className="text-gray-900">{r.shiftLabel}</div><div className="text-[10px] text-gray-500">{r.shiftDetail}</div></td>
                  <td className="px-3 py-2 text-gray-700">{r.receipt}</td>
                  {!method && <td className="px-3 py-2">{methodName(r.method)}</td>}
                  <td className="px-3 py-2 text-right font-semibold">{num(r.amount)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{when(r.paidAt)}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={current}
          totalPages={pages}
          totalItems={rows.length}
          itemsPerPage={pageSize}
          onPageChange={setPage}
          onItemsPerPageChange={n => { setPageSize(n); setPage(1) }}
        />
      </div>
    </div>
  )
}

export default CollectionPayments
