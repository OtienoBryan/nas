import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  adminApiService,
  ReportExportFormat,
  ReportExportKind,
  ReportFilters,
} from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { reportKey, saleKey, STAFF_KEY, tripsKey } from '../services/queryKeys'
import { prefetchQuery } from '../services/queryCache'
import { DATE_PRESETS, rangeError, ymd } from '../utils/dateRange'
import { exportElementToPdf } from '../utils/pdf'
import MonthlySalesChart, { aggregateMonths } from '../components/MonthlySalesChart'
import Pagination from '../components/ui/Pagination'
import { ArrowLeft, BarChart3, Download, Loader2, RefreshCw } from 'lucide-react'

const num = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

type ReportName = 'summary' | 'breakdown' | 'products' | 'collections' | 'transactions' | 'export'

const TITLES: Record<ReportName, string> = {
  summary: 'Summary',
  breakdown: 'Sales breakdown',
  products: 'Product sales',
  collections: 'Collections',
  transactions: 'Transactions',
  export: 'Export',
}

const EXPORT_KIND: Partial<Record<ReportName, ReportExportKind>> = {
  breakdown: 'SalesBreakdown',
  products: 'SalesBreakdown',
  collections: 'Collections',
  transactions: 'Transactions',
}

const GROUPS: Record<string, string[]> = {
  breakdown: ['Day', 'Trip', 'Staff', 'Item', 'Method'],
  collections: ['Staff', 'Day', 'Trip'],
}
const SALE_STATUSES = ['Completed', 'PartiallyRefunded', 'Refunded', 'Voided']

const selectCls = 'border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700'
const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-3 py-2 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>
)
const TableCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">{children}</div>
)
const Empty: React.FC<{ cols: number; loading: boolean }> = ({ cols, loading }) => (
  <tr>
    <td colSpan={cols} className="px-3 py-8 text-center text-gray-400">
      {loading ? <Loader2 className="h-4 w-4 animate-spin inline" /> : 'No data for this period.'}
    </td>
  </tr>
)

// ---- Summary ----
const MONTHLY_PRESETS: Array<{ label: string; range: () => [string, string] }> = [
  { label: 'This year', range: () => { const d = new Date(); return [ymd(new Date(d.getFullYear(), 0, 1)), ymd(new Date(d.getFullYear(), 11, 31))] } },
  { label: 'Last 12 months', range: () => { const d = new Date(); return [ymd(new Date(d.getFullYear(), d.getMonth() - 11, 1)), ymd(d)] } },
  { label: 'Last year', range: () => { const d = new Date(); return [ymd(new Date(d.getFullYear() - 1, 0, 1)), ymd(new Date(d.getFullYear() - 1, 11, 31))] } },
]

const MonthlyPerformance: React.FC = () => {
  const [[from, to], setRange] = useState<[string, string]>(MONTHLY_PRESETS[0].range())
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [exporting, setExporting] = useState(false)
  const pdfRef = useRef<HTMLDivElement>(null)
  const error = rangeError(from, to)
  const { data, loading, refreshing, error: loadError, refetch } = useCachedQuery(
    reportKey('summary-monthly-sales', { from, to }),
    () => (error ? Promise.resolve([]) : adminApiService.getReportBreakdown({ from, to, groupBy: 'Day' }))
  )
  const months = useMemo(() => (error ? [] : aggregateMonths(data ?? [], from, to)), [data, from, to, error])
  const total = months.reduce((a, m) => a + m.netSales, 0)
  const best = months.reduce((b, m) => (m.netSales > b.netSales ? m : b), { month: '', netSales: 0, transactionCount: 0, quantity: 0 })
  const bestLabel = best.netSales > 0 ? new Date(`${best.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'

  const exportPdf = async () => {
    setExporting(true)
    try {
      if (pdfRef.current) {
        await exportElementToPdf(pdfRef.current, `monthly-performance-${from}-to-${to}.pdf`, {
          header: { title: 'Monthly performance', subtitle: `${from} to ${to}`, logoUrl: '/nas.png' },
        })
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h3 className="text-xs font-bold text-gray-800">Monthly performance</h3>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-1.5">
          {MONTHLY_PRESETS.map(p => {
            const [f, t] = p.range()
            const on = f === from && t === to
            return (
              <button
                key={p.label}
                onClick={() => setRange([f, t])}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-600">From
          <input type="date" max={to || undefined} value={from} onChange={e => setRange([e.target.value, to])} className={selectCls} />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">To
          <input type="date" min={from || undefined} value={to} onChange={e => setRange([from, e.target.value])} className={selectCls} />
        </label>
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-medium">
          {(['chart', 'table'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>{v}</button>
          ))}
        </div>
        <button
          onClick={exportPdf}
          disabled={exporting || months.length === 0}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
        </button>
      </div>

      {error && <div className="mb-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2">{error}</div>}
      {loadError && !error && <div className="mb-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{loadError}</div>}

      <div ref={pdfRef} className="bg-white">
      <div className="grid grid-cols-3 gap-3 mb-3">
        {[
          ['Net sales', num(total)],
          ['Average per month', months.length ? num(total / months.length) : '—'],
          ['Best month', best.netSales > 0 ? `${bestLabel} · ${num(best.netSales)}` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-gray-50 px-3 py-2">
            <div className="text-[10px] font-medium text-gray-500">{k}</div>
            <div className="text-sm font-bold text-gray-900 mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <TableCard>
        {loading ? (
          <div className="h-[260px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : months.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-xs text-gray-400">No data for this period.</div>
        ) : view === 'chart' ? (
          total === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-xs text-gray-400">No sales in this period.</div>
          ) : (
            <div className="p-3"><MonthlySalesChart data={months} /></div>
          )
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr><Th>Month</Th><Th right>Sales</Th><Th right>Items</Th><Th right>Net sales</Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {months.map(m => (
                <tr key={m.month}>
                  <td className="px-3 py-1.5">{new Date(`${m.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</td>
                  <td className="px-3 py-1.5 text-right">{m.transactionCount}</td>
                  <td className="px-3 py-1.5 text-right">{m.quantity}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{num(m.netSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
      </div>
    </div>
  )
}

// The /reports/summary endpoint has a recurring server-side 500, so this composes the same page from
// endpoints that already work (breakdown, collections, shift report, transactions). Tax, discount totals
// and unresolved sync exceptions aren't derivable this way and are called out rather than guessed.
const SummaryBody: React.FC<{ filters: ReportFilters }> = ({ filters }) => {
  const api = adminApiService
  const base = { from: filters.from, to: filters.to, staffId: filters.staffId }

  const breakdownQ = useCachedQuery(reportKey('summary2-breakdown', base), () =>
    api.getReportBreakdown({ ...base, groupBy: 'Day' }))
  const collectionsQ = useCachedQuery(reportKey('summary2-collections', base), () =>
    api.getReportCollections({ ...base, groupBy: 'Day' }))
  const shiftsQ = useCachedQuery(reportKey('summary2-shifts', base), () =>
    api.getShiftReport(base.from, base.to, base.staffId ?? '', 1, 1000))
  const txCountQ = useCachedQuery(reportKey('summary2-tx-count', base), () =>
    api.getReportTransactions({ ...base, page: 1, pageSize: 1 }))
  const txTotal = txCountQ.data?.total ?? 0
  const txAllQ = useCachedQuery(reportKey('summary2-tx-all', { ...base, txTotal }), () =>
    txTotal > 0 ? api.getReportTransactions({ ...base, page: 1, pageSize: Math.min(txTotal, 5000) }) : Promise.resolve({ items: [], total: 0 })
  )

  const initialLoad = breakdownQ.loading || collectionsQ.loading || shiftsQ.loading || txCountQ.loading || (txTotal > 0 && txAllQ.loading)
  const refreshing = breakdownQ.refreshing || collectionsQ.refreshing || shiftsQ.refreshing || txCountQ.refreshing || txAllQ.refreshing
  const loadError = breakdownQ.error || collectionsQ.error || shiftsQ.error || txCountQ.error || txAllQ.error
  const refetchAll = () => { breakdownQ.refetch(); collectionsQ.refetch(); shiftsQ.refetch(); txCountQ.refetch(); txAllQ.refetch() }

  const breakdownRows = breakdownQ.data ?? []
  const grossSales = breakdownRows.reduce((a, r) => a + r.grossSales, 0)
  const netSales = breakdownRows.reduce((a, r) => a + r.netSales, 0)
  const totalQty = breakdownRows.reduce((a, r) => a + r.quantity, 0)

  const allTx = txAllQ.data?.items ?? []
  const voidRows = allTx.filter(t => t.status === 'Voided')
  const voidCount = voidRows.length
  const voidTotal = voidRows.reduce((a, t) => a + t.total, 0)
  const refundTotal = allTx.reduce((a, t) => a + t.refundedAmount, 0)
  const flaggedSaleCount = allTx.filter(t => t.requiresReview).length
  // paymentState's own values aren't a known enum here, so match by keyword rather than an exact lookup
  const pendingRows = allTx.filter(t => /pending|partial|unpaid|await/i.test(t.paymentState))
  const pendingPaymentCount = pendingRows.length
  const pendingPaymentAmount = pendingRows.reduce((a, t) => a + (t.total - t.refundedAmount), 0)

  const collectionsByMethod = useMemo(() => {
    const byCode = new Map<string, { expected: number; declared: number; variance: number }>()
    for (const r of collectionsQ.data ?? []) {
      const cur = byCode.get(r.methodCode) ?? { expected: 0, declared: 0, variance: 0 }
      cur.expected += r.expected; cur.declared += r.declared; cur.variance += r.variance
      byCode.set(r.methodCode, cur)
    }
    return [...byCode.entries()].map(([methodCode, v]) => ({ methodCode, ...v }))
  }, [collectionsQ.data])
  const collectionsTotal = collectionsByMethod.reduce((a, c) => a + c.declared, 0)

  const shiftRows = shiftsQ.data?.items ?? []
  const shifts = [
    ['Open', shiftRows.filter(s => s.status === 'Open').length],
    ['Pending review', shiftRows.filter(s => s.requiresReview).length],
    ['Closed', shiftRows.filter(s => s.status === 'Closed').length],
    ['With variance', shiftRows.filter(s => s.varianceTotal !== 0).length],
  ] as const

  const tiles = [
    ['Transactions', String(txTotal)],
    ['Gross sales', num(grossSales)],
    ['Net sales', num(netSales)],
    ['Avg sale value', txTotal ? num(netSales / txTotal) : '—'],
    ['Quantity sold', String(totalQty)],
    ['Voids', `${voidCount} · ${num(voidTotal)}`],
    ['Refunds', num(refundTotal)],
    ['Collections', num(collectionsTotal)],
  ]
  const exceptions = [
    ['Pending payments (approx.)', `${pendingPaymentCount} · ${num(pendingPaymentAmount)}`],
    ['Flagged sales', String(flaggedSaleCount)],
  ]

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={refetchAll} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loadError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">{loadError}</div>}

      {initialLoad ? (
        <div className="py-10 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {tiles.map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3">
                <div className="text-[11px] font-medium text-gray-500">{k}</div>
                <div className="text-base font-bold text-gray-900 mt-0.5">{v}</div>
              </div>
            ))}
          </div>

          <MonthlyPerformance />

          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <h3 className="text-xs font-bold text-gray-800 mb-2">Collections by method</h3>
              <TableCard>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr><Th>Method</Th><Th right>Expected</Th><Th right>Declared</Th><Th right>Variance</Th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {collectionsByMethod.length === 0 ? <Empty cols={4} loading={collectionsQ.loading} /> : collectionsByMethod.map(c => (
                      <tr key={c.methodCode}>
                        <td className="px-3 py-2 font-medium">{c.methodCode}</td>
                        <td className="px-3 py-2 text-right">{num(c.expected)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{num(c.declared)}</td>
                        <td className={`px-3 py-2 text-right ${c.variance === 0 ? 'text-green-600' : 'text-red-600'}`}>{num(c.variance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableCard>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold text-gray-800 mb-2">Shifts</h3>
                <div className="grid grid-cols-4 gap-3">
                  {shifts.map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-white border border-gray-100 shadow-sm px-3 py-2.5">
                      <div className="text-[10px] font-medium text-gray-500">{k}</div>
                      <div className={`text-base font-bold mt-0.5 ${k === 'With variance' && v > 0 ? 'text-red-600' : 'text-gray-900'}`}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-800 mb-2">Open exceptions</h3>
                <TableCard>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-gray-100">
                      {exceptions.map(([k, v]) => (
                        <tr key={k}><td className="px-3 py-2 text-gray-600">{k}</td><td className="px-3 py-2 text-right font-semibold">{v}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </TableCard>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Page ----
const ReportView: React.FC = () => {
  const navigate = useNavigate()
  const params = useParams()
  const report = (params.report ?? '') as ReportName
  const valid = report in TITLES

  const [sp, setSp] = useSearchParams()
  const [[from, to], setRange] = useState<[string, string]>(() => {
    const f = sp.get('from'), t = sp.get('to')
    return f && t ? [f, t] : DATE_PRESETS[report === 'products' ? 0 : report === 'breakdown' ? 3 : 2].range()
  })
  const [staffId, setStaffId] = useState(sp.get('staffId') ?? '')
  const [serviceNumber, setServiceNumber] = useState(sp.get('serviceNumber') ?? '') // the trip
  const [groupBy, setGroupBy] = useState(() => {
    const g = sp.get('groupBy')
    return g && GROUPS[report]?.includes(g) ? g : GROUPS[report]?.[0] ?? ''
  })
  useEffect(() => {
    setSp({ from, to, ...(staffId ? { staffId } : {}), ...((report === 'transactions' || report === 'breakdown') && serviceNumber ? { serviceNumber } : {}), ...(GROUPS[report] ? { groupBy } : {}) }, { replace: true })
    // setSp changes identity on every navigation, so it is intentionally not a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, staffId, serviceNumber, groupBy, report])
  const [saleStatus, setSaleStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [exportKind, setExportKind] = useState<ReportExportKind>('Transactions')
  const [productSort, setProductSort] = useState<'value' | 'qty'>('value')
  const [productPage, setProductPage] = useState(1)
  const [productPageSize, setProductPageSize] = useState(10)
  const [exporting, setExporting] = useState<ReportExportFormat | null>(null)
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const error = rangeError(from, to)
  const filters: ReportFilters = {
    from, to, staffId,
    serviceNumber: report === 'transactions' || report === 'breakdown' ? serviceNumber || undefined : undefined,
    groupBy: GROUPS[report] ? groupBy : report === 'products' ? 'Item' : undefined,
    saleStatus: report === 'transactions' ? saleStatus : undefined,
    page: report === 'transactions' ? page : undefined,
    pageSize: report === 'transactions' ? pageSize : undefined,
  }
  const skip = <T,>(empty: T) => Promise.resolve(empty)
  const api = adminApiService

  const breakdown = useCachedQuery(reportKey('breakdown', filters), () =>
    (report !== 'breakdown' && report !== 'products') || error ? skip([]) : api.getReportBreakdown(filters))
  const collections = useCachedQuery(reportKey('collections', filters), () =>
    report !== 'collections' || error ? skip([]) : api.getReportCollections(filters))
  const transactions = useCachedQuery(reportKey('transactions', filters), () =>
    report !== 'transactions' || error ? skip({ items: [], total: 0 }) : api.getReportTransactions(filters))
  const staff = useCachedQuery(STAFF_KEY, () => api.getRestaurantStaff())
  // Trips in the chosen period to pick from; sales carry the trip's service number
  const tripQuery = { from, to, page: 1, pageSize: 200 }
  const trips = useCachedQuery(tripsKey(tripQuery), () =>
    (report !== 'transactions' && report !== 'breakdown') || error ? skip({ items: [], total: 0 }) : api.getTripsPage(tripQuery))
  const tripOptions = useMemo(() => {
    const seen = new Set<string>()
    return (trips.data?.items ?? []).filter(t => !seen.has(t.serviceNumber) && !!seen.add(t.serviceNumber))
  }, [trips.data])

  const active = { breakdown, collections, transactions }[report as 'breakdown'] as typeof breakdown | undefined
  const totalTx = transactions.data?.total ?? 0

  const breakdownRows = useMemo(() => (
    groupBy === 'Day' ? [...(breakdown.data ?? [])].sort((a, b) => b.key.localeCompare(a.key)) : (breakdown.data ?? [])
  ), [breakdown.data, groupBy])

  const productRows = useMemo(() => [...(breakdown.data ?? [])].sort((a, b) =>
    productSort === 'value' ? b.netSales - a.netSales : b.quantity - a.quantity || b.netSales - a.netSales
  ), [breakdown.data, productSort])
  const productTotals = useMemo(() => ({
    qty: productRows.reduce((a, r) => a + r.quantity, 0),
    value: productRows.reduce((a, r) => a + r.netSales, 0),
    gross: productRows.reduce((a, r) => a + r.grossSales, 0),
    transactions: productRows.reduce((a, r) => a + r.transactionCount, 0),
  }), [productRows])

  // Readable labels for every filter currently applied, for the exported PDF
  const breakdownFilters = [
    { label: 'Period', value: `${from} to ${to}` },
    { label: 'Group by', value: groupBy },
    staffId ? { label: 'Waiter', value: (staff.data ?? []).find(s => String(s.id) === String(staffId))?.fullName ?? staffId } : null,
    serviceNumber ? { label: 'Trip', value: (() => {
      const t = tripOptions.find(x => x.serviceNumber === serviceNumber)
      return t ? `${t.serviceType} ${t.serviceNumber}` : serviceNumber
    })() } : null,
  ].filter((x): x is { label: string; value: string } => !!x)
  const breakdownPdfRef = useRef<HTMLDivElement>(null)
  const productsPdfRef = useRef<HTMLDivElement>(null)

  if (!valid) return <div className="p-6 text-sm text-gray-500">Unknown report.</div>

  const reset = () => { setPage(1); setProductPage(1) }
  const exportBreakdownPdf = async () => {
    setExporting('Pdf')
    setExportMsg(null)
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (breakdownPdfRef.current) {
        await exportElementToPdf(breakdownPdfRef.current, `sales-breakdown-${from}-to-${to}.pdf`, {
          header: { title: 'Sales breakdown', subtitle: `${from} to ${to} · Grouped by ${groupBy}`, logoUrl: '/nas.png' },
        })
      }
      setExportMsg({ ok: true, text: 'Downloaded PDF' })
    } catch (e) {
      setExportMsg({ ok: false, text: e instanceof Error ? e.message : 'Export failed' })
    } finally {
      setExporting(null)
    }
  }
  // Same stat cards and table design as on screen, but every matching product (not just the current page)
  const exportProductsPdf = async () => {
    setExporting('Pdf')
    setExportMsg(null)
    try {
      if (productsPdfRef.current) {
        await exportElementToPdf(productsPdfRef.current, `product-sales-${from}-to-${to}.pdf`, {
          header: { title: 'Product sales', subtitle: `${from} to ${to}`, logoUrl: '/nas.png' },
        })
      }
      setExportMsg({ ok: true, text: 'Downloaded PDF' })
    } catch (e) {
      setExportMsg({ ok: false, text: e instanceof Error ? e.message : 'Export failed' })
    } finally {
      setExporting(null)
    }
  }
  const doExport = async (format: ReportExportFormat) => {
    if (report === 'breakdown' && format === 'Pdf') return exportBreakdownPdf()
    if (report === 'products' && format === 'Pdf') return exportProductsPdf()
    const kind = report === 'export' ? exportKind : EXPORT_KIND[report]
    if (!kind) return
    setExporting(format)
    setExportMsg(null)
    try {
      const name = await api.exportReport(kind, format, { ...filters, page: undefined, pageSize: undefined })
      setExportMsg({ ok: true, text: `Downloaded ${name}` })
    } catch (e) {
      setExportMsg({ ok: false, text: e instanceof Error ? e.message : 'Export failed' })
    } finally {
      setExporting(null)
    }
  }
  const canExport = report === 'export' || !!EXPORT_KIND[report]
  const refreshing = !!active?.refreshing

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/restaurant/reports')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">{TITLES[report]}</h1>
        <div className="flex-1" />
        {report === 'products' && (
          <button
            onClick={() => navigate(`/restaurant/reports/products/performance?${new URLSearchParams({ from, to, staffId })}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
          >
            <BarChart3 className="h-3.5 w-3.5" /> Performance graph
          </button>
        )}
        {report !== 'export' && report !== 'summary' && (
          <button onClick={() => active?.refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
            <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map(p => {
            const [f, t] = p.range()
            const on = f === from && t === to
            return (
              <button
                key={p.label}
                onClick={() => { setRange([f, t]); setServiceNumber(''); reset() }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-600">From
          <input type="date" max={to || undefined} value={from} onChange={e => { setRange([e.target.value, to]); setServiceNumber(''); reset() }} className={selectCls} />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">To
          <input type="date" min={from || undefined} value={to} onChange={e => { setRange([from, e.target.value]); setServiceNumber(''); reset() }} className={selectCls} />
        </label>
        <select value={staffId} onChange={e => { setStaffId(e.target.value); setServiceNumber(''); reset() }} className={selectCls} aria-label="Staff">
          <option value="">All waiters</option>
          {(staff.data ?? []).filter(m => m.role === 'Waiter').sort((a, b) => a.fullName.localeCompare(b.fullName)).map(m => (
            <option key={m.id} value={m.id}>{m.fullName} (#{m.staffNumber})</option>
          ))}
        </select>
        {GROUPS[report] && (
          <label className="flex items-center gap-1 text-xs text-gray-600">Group by
            <select value={groupBy} onChange={e => setGroupBy(e.target.value)} className={selectCls}>
              {GROUPS[report].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        )}
        {report === 'products' && (
          <label className="flex items-center gap-1 text-xs text-gray-600">Sort by
            <select value={productSort} onChange={e => { setProductSort(e.target.value as 'value' | 'qty'); setProductPage(1) }} className={selectCls}>
              <option value="value">Value sold</option>
              <option value="qty">Quantity sold</option>
            </select>
          </label>
        )}
        {(report === 'transactions' || report === 'breakdown') && (
          <select value={serviceNumber} onChange={e => { setServiceNumber(e.target.value); reset() }} className={selectCls} aria-label="Trip">
            <option value="">All trips</option>
            {tripOptions.map(t => (
              <option key={t.id} value={t.serviceNumber}>
                {`${t.serviceType} ${t.serviceNumber} · ${t.route || [t.origin, t.destination].filter(Boolean).join(' → ') || '—'}`}
              </option>
            ))}
          </select>
        )}
        {report === 'transactions' && (
          <select value={saleStatus} onChange={e => { setSaleStatus(e.target.value); reset() }} className={selectCls} aria-label="Sale status">
            <option value="">Any status</option>
            {SALE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {report === 'export' && (
          <select value={exportKind} onChange={e => setExportKind(e.target.value as ReportExportKind)} className={selectCls} aria-label="Report to export">
            <option value="Transactions">Transactions</option>
            <option value="Shifts">Shifts</option>
            <option value="Collections">Collections</option>
            <option value="SalesBreakdown">Sales breakdown</option>
          </select>
        )}
        {canExport && (
          <div className="flex items-center gap-1.5 ml-auto">
            {(['Csv', 'Xlsx', 'Pdf'] as ReportExportFormat[]).map(f => (
              <button
                key={f}
                onClick={() => doExport(f)}
                disabled={!!exporting || !!error}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {exporting === f ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                {f === 'Xlsx' ? 'Excel' : f.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-4 py-2">{error}</div>}
      {exportMsg && (
        <div className={`text-xs rounded-lg px-4 py-2 border ${exportMsg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{exportMsg.text}</div>
      )}
      {!error && active?.error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">{active.error}</div>}

      {report === 'export' && (
        <p className="text-xs text-gray-500">Choose the report, period and optional waiter, then pick a format. The file uses the same filters as the on-screen report.</p>
      )}

      {report === 'summary' && !error && <SummaryBody filters={filters} />}

      {report === 'breakdown' && groupBy !== 'Item' && <p className="text-[11px] text-gray-500">Click a row to see the sales behind it.</p>}
      {report === 'breakdown' && (
        <TableCard>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr><Th>{groupBy}</Th><Th right>Transactions</Th><Th right>Quantity</Th><Th right>Net sales</Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {breakdownRows.length === 0 ? <Empty cols={4} loading={breakdown.loading} /> : breakdownRows.map(r => (
                <tr
                  key={r.key}
                  onClick={() => groupBy !== 'Item' && navigate(`/restaurant/reports/breakdown/sales?${new URLSearchParams({ groupBy, key: r.key, label: r.label, from, to, staffId })}`)}
                  className={groupBy === 'Item' ? 'hover:bg-gray-50' : 'hover:bg-blue-50 cursor-pointer'}
                  title={groupBy === 'Item' ? undefined : 'Click to see the sales'}
                >
                  <td className="px-3 py-2 font-medium text-gray-900">{r.label}</td>
                  <td className="px-3 py-2 text-right">{r.transactionCount}</td>
                  <td className="px-3 py-2 text-right">{r.quantity}</td>
                  <td className="px-3 py-2 text-right font-semibold">{num(r.netSales)}</td>
                </tr>
              ))}
            </tbody>
            {breakdownRows.length > 0 && (
              <tfoot className="bg-gray-50 font-bold text-gray-900">
                <tr>
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{breakdownRows.reduce((a, r) => a + r.transactionCount, 0)}</td>
                  <td className="px-3 py-2 text-right">{breakdownRows.reduce((a, r) => a + r.quantity, 0)}</td>
                  <td className="px-3 py-2 text-right">{num(breakdownRows.reduce((a, r) => a + r.netSales, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </TableCard>
      )}

      {/* Off-screen snapshot captured for the breakdown report's PDF export */}
      {report === 'breakdown' && (
        <div ref={breakdownPdfRef} style={{ position: 'fixed', left: -99999, top: 0, width: 1100, background: '#fff', padding: 16 }}>
          <div className="flex flex-wrap gap-2 mb-4">
            {breakdownFilters.map(ff => (
              <div key={ff.label} className="text-xs text-gray-700 bg-gray-100 rounded-full px-3 py-1">
                <span className="font-semibold">{ff.label}:</span> {ff.value}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }} className="mb-4">
            <div className="rounded-xl bg-white border border-gray-200 px-4 py-3">
              <div className="text-xs font-semibold text-gray-600">Transactions</div>
              <div className="text-lg font-bold text-gray-900 mt-1">{breakdownRows.reduce((a, r) => a + r.transactionCount, 0)}</div>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 px-4 py-3">
              <div className="text-xs font-semibold text-gray-600">Quantity</div>
              <div className="text-lg font-bold text-gray-900 mt-1">{breakdownRows.reduce((a, r) => a + r.quantity, 0)}</div>
            </div>
            <div className="rounded-xl bg-blue-600 px-4 py-3">
              <div className="text-xs font-semibold text-blue-50">Net sales</div>
              <div className="text-lg font-bold text-white mt-1">{num(breakdownRows.reduce((a, r) => a + r.netSales, 0))}</div>
            </div>
          </div>
          <table className="w-full text-xs border border-gray-200">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr><Th>{groupBy}</Th><Th right>Transactions</Th><Th right>Quantity</Th><Th right>Net sales</Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {breakdownRows.map(r => (
                <tr key={r.key}>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.label}</td>
                  <td className="px-3 py-2 text-right">{r.transactionCount}</td>
                  <td className="px-3 py-2 text-right">{r.quantity}</td>
                  <td className="px-3 py-2 text-right font-semibold">{num(r.netSales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report === 'products' && (() => {
        const rows = productRows
        const { qty: totalQty, value: totalValue, gross: totalGross } = productTotals
        const pages = Math.max(1, Math.ceil(rows.length / productPageSize))
        const current = Math.min(productPage, pages)
        const visible = rows.slice((current - 1) * productPageSize, current * productPageSize)
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Products sold', String(rows.length)],
                ['Total quantity', String(totalQty)],
                ['Total value (net)', num(totalValue)],
                ['Gross value', num(totalGross)],
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
                    <tr><Th>#</Th><Th>Product</Th><Th>Code</Th><Th right>Qty sold</Th><Th right>Sales</Th><Th right>Value (net)</Th><Th>Share of value</Th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.length === 0 ? <Empty cols={7} loading={breakdown.loading} /> : visible.map((r, i) => {
                      const share = totalValue ? (r.netSales / totalValue) * 100 : 0
                      return (
                        <tr key={r.key} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400">{(current - 1) * productPageSize + i + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{r.label}</td>
                          <td className="px-3 py-2 font-mono text-gray-600">{r.key}</td>
                          <td className="px-3 py-2 text-right font-semibold">{r.quantity}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{r.transactionCount}</td>
                          <td className="px-3 py-2 text-right font-semibold">{num(r.netSales)}</td>
                          <td className="px-3 py-2 w-40">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${share}%` }} /></div>
                              <span className="text-[10px] text-gray-500 w-10 text-right">{share.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot className="bg-gray-50 font-bold text-gray-900">
                      <tr>
                        <td className="px-3 py-2" colSpan={3}>Total</td>
                        <td className="px-3 py-2 text-right">{totalQty}</td>
                        <td className="px-3 py-2 text-right">{productTotals.transactions}</td>
                        <td className="px-3 py-2 text-right">{num(totalValue)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              <Pagination
                currentPage={current}
                totalPages={pages}
                totalItems={rows.length}
                itemsPerPage={productPageSize}
                onPageChange={setProductPage}
                onItemsPerPageChange={n => { setProductPageSize(n); setProductPage(1) }}
              />
            </div>
          </div>
        )
      })()}

      {/* Off-screen snapshot captured for the products report's PDF export: every matching product, not just the current page */}
      {report === 'products' && (
        <div ref={productsPdfRef} style={{ position: 'fixed', left: -99999, top: 0, width: 1100, background: '#fff', padding: 16 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              ['Products sold', String(productRows.length)],
              ['Total quantity', String(productTotals.qty)],
              ['Total value (net)', num(productTotals.value)],
              ['Gross value', num(productTotals.gross)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3">
                <div className="text-[11px] font-medium text-gray-500">{k}</div>
                <div className="text-base font-bold text-gray-900 mt-0.5">{v}</div>
              </div>
            ))}
          </div>
          <table className="w-full text-xs border border-gray-200">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr><Th>#</Th><Th>Product</Th><Th>Code</Th><Th right>Qty sold</Th><Th right>Sales</Th><Th right>Value (net)</Th><Th>Share of value</Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productRows.map((r, i) => {
                const share = productTotals.value ? (r.netSales / productTotals.value) * 100 : 0
                return (
                  <tr key={r.key}>
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{r.label}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{r.key}</td>
                    <td className="px-3 py-2 text-right font-semibold">{r.quantity}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.transactionCount}</td>
                    <td className="px-3 py-2 text-right font-semibold">{num(r.netSales)}</td>
                    <td className="px-3 py-2 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${share}%` }} /></div>
                        <span className="text-[10px] text-gray-500 w-10 text-right">{share.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {productRows.length > 0 && (
              <tfoot className="bg-gray-50 font-bold text-gray-900">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>Total</td>
                  <td className="px-3 py-2 text-right">{productTotals.qty}</td>
                  <td className="px-3 py-2 text-right">{productTotals.transactions}</td>
                  <td className="px-3 py-2 text-right">{num(productTotals.value)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {report === 'collections' && (
        <TableCard>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr><Th>{groupBy}</Th><Th>Method</Th><Th right>Expected</Th><Th right>Declared</Th><Th right>Variance</Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(collections.data ?? []).length === 0 ? <Empty cols={5} loading={collections.loading} /> : (collections.data ?? []).map((r, i) => (
                <tr key={`${r.groupKey}-${r.methodCode}-${i}`} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{r.groupLabel}</td>
                  <td className="px-3 py-2">{r.methodCode}</td>
                  <td className="px-3 py-2 text-right">{num(r.expected)}</td>
                  <td className="px-3 py-2 text-right">{num(r.declared)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.variance === 0 ? 'text-green-600' : 'text-red-600'}`}>{num(r.variance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      )}

      {report === 'transactions' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <Th>Receipt</Th><Th>Sale time</Th><Th>Staff</Th><Th>Service</Th><Th>Seat / table</Th>
                  <Th right>Items</Th><Th right>Total</Th><Th right>Refunded</Th><Th>Status</Th><Th>Payment</Th><Th>Methods</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(transactions.data?.items ?? []).length === 0 ? <Empty cols={11} loading={transactions.loading} /> : (transactions.data?.items ?? []).map(t => (
                  <tr
                    key={t.saleId}
                    onClick={() => navigate(`/restaurant/sales/${t.saleId}`)}
                    onMouseEnter={() => prefetchQuery(saleKey(t.saleId), () => api.getRestaurantSale(t.saleId))}
                    className="hover:bg-blue-50 cursor-pointer"
                    title="Click to open the sale"
                  >
                    <td className="px-3 py-2"><div className="font-medium text-gray-900">{t.receiptNumber}</div><div className="text-[10px] text-gray-400">{t.saleReference}</div></td>
                    <td className="px-3 py-2 whitespace-nowrap">{when(t.occurredAtUtc)}{t.capturedOffline && <span className="ml-1 text-[10px] text-gray-400">offline</span>}</td>
                    <td className="px-3 py-2"><div>{t.staffName}</div><div className="text-[10px] text-gray-400">#{t.staffNumber}</div></td>
                    <td className="px-3 py-2">{t.serviceNumber || '—'}{t.route ? <div className="text-[10px] text-gray-400">{t.route}</div> : null}</td>
                    <td className="px-3 py-2">{t.seatNumber || t.tableNumber || '—'}</td>
                    <td className="px-3 py-2 text-right">{t.itemCount}</td>
                    <td className="px-3 py-2 text-right font-semibold">{num(t.total)}</td>
                    <td className="px-3 py-2 text-right">{num(t.refundedAmount)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.status === 'Completed' ? 'bg-green-100 text-green-700' : t.status === 'Voided' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{t.status}</span>
                      {t.requiresReview && <span title="Flagged for review" className="ml-1 text-amber-600">⚠</span>}
                    </td>
                    <td className="px-3 py-2">{t.paymentState}</td>
                    <td className="px-3 py-2">{t.paymentMethods || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(totalTx / pageSize))}
            totalItems={totalTx}
            itemsPerPage={pageSize}
            onPageChange={setPage}
            onItemsPerPageChange={n => { setPageSize(n); setPage(1) }}
          />
        </div>
      )}
    </div>
  )
}

export default ReportView
