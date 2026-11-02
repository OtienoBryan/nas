import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  adminApiService,
  ReportExportFormat,
  ReportExportKind,
  ReportFilters,
  ReportSummary,
} from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { reportKey, saleKey, STAFF_KEY, tripsKey } from '../services/queryKeys'
import { prefetchQuery } from '../services/queryCache'
import { DATE_PRESETS, rangeError } from '../utils/dateRange'
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
const SummaryBody: React.FC<{ d: ReportSummary }> = ({ d }) => {
  const cur = d.currency ? `${d.currency} ` : ''
  const tiles = [
    ['Transactions', String(d.sales.transactionCount)],
    ['Gross sales', cur + num(d.sales.grossSales)],
    ['Voids', `${d.sales.voidCount} · ${cur}${num(d.sales.voidTotal)}`],
    ['Refunds', cur + num(d.sales.refundTotal)],
    ['Discounts', cur + num(d.sales.discountTotal)],
    ['Tax', cur + num(d.sales.taxTotal)],
    ['Net sales', cur + num(d.sales.netSales)],
    ['Collections', cur + num(d.collectionsTotal)],
  ]
  const shifts = [
    ['Open', d.shifts.open],
    ['Pending review', d.shifts.pendingReview],
    ['Closed', d.shifts.closed],
    ['With variance', d.shifts.withVariance],
  ] as const
  const exceptions = [
    ['Pending payments', `${d.pendingPaymentCount} · ${cur}${num(d.pendingPaymentAmount)}`],
    ['Flagged sales', String(d.flaggedSaleCount)],
    ['Unresolved sync exceptions', String(d.unresolvedSyncExceptions)],
  ]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3">
            <div className="text-[11px] font-medium text-gray-500">{k}</div>
            <div className="text-base font-bold text-gray-900 mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <h3 className="text-xs font-bold text-gray-800 mb-2">Collections by method</h3>
          <TableCard>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr><Th>Method</Th><Th right>Confirmed</Th><Th right>Pending</Th><Th right>Failed</Th><Th right>Refunds</Th><Th right>Net</Th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.collections.length === 0 ? <Empty cols={6} loading={false} /> : d.collections.map(c => (
                  <tr key={c.methodCode}>
                    <td className="px-3 py-2 font-medium">{c.methodCode}</td>
                    <td className="px-3 py-2 text-right">{num(c.confirmed)}</td>
                    <td className="px-3 py-2 text-right">{num(c.pending)}</td>
                    <td className="px-3 py-2 text-right">{num(c.failed)}</td>
                    <td className="px-3 py-2 text-right">{num(c.refunds)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{num(c.net)}</td>
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
    return f && t ? [f, t] : DATE_PRESETS[report === 'products' ? 3 : 2].range()
  })
  const [staffId, setStaffId] = useState(sp.get('staffId') ?? '')
  const [serviceNumber, setServiceNumber] = useState(sp.get('serviceNumber') ?? '') // the trip
  const [groupBy, setGroupBy] = useState(() => {
    const g = sp.get('groupBy')
    return g && GROUPS[report]?.includes(g) ? g : GROUPS[report]?.[0] ?? ''
  })
  useEffect(() => {
    setSp({ from, to, ...(staffId ? { staffId } : {}), ...(report === 'transactions' && serviceNumber ? { serviceNumber } : {}), ...(GROUPS[report] ? { groupBy } : {}) }, { replace: true })
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
    serviceNumber: report === 'transactions' ? serviceNumber || undefined : undefined,
    groupBy: GROUPS[report] ? groupBy : report === 'products' ? 'Item' : undefined,
    saleStatus: report === 'transactions' ? saleStatus : undefined,
    page: report === 'transactions' ? page : undefined,
    pageSize: report === 'transactions' ? pageSize : undefined,
  }
  const skip = <T,>(empty: T) => Promise.resolve(empty)
  const api = adminApiService

  const summary = useCachedQuery(reportKey('summary', filters), () =>
    report !== 'summary' || error ? skip(null as unknown as ReportSummary) : api.getReportSummary(filters))
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
    report !== 'transactions' || error ? skip({ items: [], total: 0 }) : api.getTripsPage(tripQuery))
  const tripOptions = useMemo(() => {
    const seen = new Set<string>()
    return (trips.data?.items ?? []).filter(t => !seen.has(t.serviceNumber) && !!seen.add(t.serviceNumber))
  }, [trips.data])

  const active = { summary, breakdown, collections, transactions }[report as 'summary'] as typeof summary | undefined
  const totalTx = transactions.data?.total ?? 0

  if (!valid) return <div className="p-6 text-sm text-gray-500">Unknown report.</div>

  const reset = () => { setPage(1); setProductPage(1) }
  const doExport = async (format: ReportExportFormat) => {
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
        {report !== 'export' && (
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
        {report === 'transactions' && (
          <select value={serviceNumber} onChange={e => { setServiceNumber(e.target.value); reset() }} className={selectCls} aria-label="Trip">
            <option value="">All trips</option>
            {tripOptions.map(t => (
              <option key={t.id} value={t.serviceNumber}>
                {`${t.serviceType} ${t.serviceNumber} · ${t.route || [t.origin, t.destination].filter(Boolean).join(' → ') || '—'} · ${(t.serviceDate ?? '').slice(0, 10)}`}
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

      {report === 'summary' && !error && (
        summary.loading || !summary.data
          ? <div className="py-10 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          : <SummaryBody d={summary.data} />
      )}

      {report === 'breakdown' && groupBy !== 'Item' && <p className="text-[11px] text-gray-500">Click a row to see the sales behind it.</p>}
      {report === 'breakdown' && (
        <TableCard>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr><Th>{groupBy}</Th><Th right>Transactions</Th><Th right>Quantity</Th><Th right>Gross sales</Th><Th right>Net sales</Th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(breakdown.data ?? []).length === 0 ? <Empty cols={5} loading={breakdown.loading} /> : (breakdown.data ?? []).map(r => (
                <tr
                  key={r.key}
                  onClick={() => groupBy !== 'Item' && navigate(`/restaurant/reports/breakdown/sales?${new URLSearchParams({ groupBy, key: r.key, label: r.label, from, to, staffId })}`)}
                  className={groupBy === 'Item' ? 'hover:bg-gray-50' : 'hover:bg-blue-50 cursor-pointer'}
                  title={groupBy === 'Item' ? undefined : 'Click to see the sales'}
                >
                  <td className="px-3 py-2 font-medium text-gray-900">{r.label}</td>
                  <td className="px-3 py-2 text-right">{r.transactionCount}</td>
                  <td className="px-3 py-2 text-right">{r.quantity}</td>
                  <td className="px-3 py-2 text-right">{num(r.grossSales)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{num(r.netSales)}</td>
                </tr>
              ))}
            </tbody>
            {(breakdown.data ?? []).length > 0 && (
              <tfoot className="bg-gray-50 font-bold text-gray-900">
                <tr>
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{(breakdown.data ?? []).reduce((a, r) => a + r.transactionCount, 0)}</td>
                  <td className="px-3 py-2 text-right">{(breakdown.data ?? []).reduce((a, r) => a + r.quantity, 0)}</td>
                  <td className="px-3 py-2 text-right">{num((breakdown.data ?? []).reduce((a, r) => a + r.grossSales, 0))}</td>
                  <td className="px-3 py-2 text-right">{num((breakdown.data ?? []).reduce((a, r) => a + r.netSales, 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </TableCard>
      )}

      {report === 'products' && (() => {
        const rows = [...(breakdown.data ?? [])].sort((a, b) =>
          productSort === 'value' ? b.netSales - a.netSales : b.quantity - a.quantity || b.netSales - a.netSales)
        const totalQty = rows.reduce((a, r) => a + r.quantity, 0)
        const totalValue = rows.reduce((a, r) => a + r.netSales, 0)
        const totalGross = rows.reduce((a, r) => a + r.grossSales, 0)
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
                        <td className="px-3 py-2 text-right">{rows.reduce((a, r) => a + r.transactionCount, 0)}</td>
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
