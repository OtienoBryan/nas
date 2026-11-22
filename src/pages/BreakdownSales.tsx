import { useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { adminApiService, ReportFilters, TransactionRow } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { reportKey, saleKey, tripsKey, STAFF_KEY, PAYMENT_METHODS_KEY } from '../services/queryKeys'
import { prefetchQuery } from '../services/queryCache'
import { exportElementToPdf } from '../utils/pdf'
import Pagination from '../components/ui/Pagination'
import { ArrowLeft, Download, Loader2, RefreshCw } from 'lucide-react'

const escapeCSV = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const num = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-3 py-2 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>
)
const selectCls = 'border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 disabled:bg-gray-50 disabled:text-gray-400'

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

  // Locked to this row's own dimension; the other two stay open for further filtering
  const [staffId, setStaffId] = useState(groupBy === 'Staff' ? key : sp.get('staffId') ?? '')
  const [serviceNumber, setServiceNumber] = useState(groupBy === 'Trip' ? key : '')
  const [methodCode, setMethodCode] = useState(groupBy === 'Method' ? key : '')
  const reset = () => setPage(1)

  // Narrow the report's filters down to this row
  const f: ReportFilters = {
    from: sp.get('from') ?? '', to: sp.get('to') ?? '',
    staffId, serviceNumber: serviceNumber || undefined, methodCode: methodCode || undefined,
    page, pageSize,
  }
  if (groupBy === 'Day') { f.from = key; f.to = key }

  const valid = !!f.from && !!f.to && !!key && ['Day', 'Staff', 'Method', 'Trip'].includes(groupBy)
  const { data, loading, refreshing, error, refetch } = useCachedQuery(reportKey('breakdown-sales', f), () =>
    valid ? adminApiService.getReportTransactions(f) : Promise.resolve({ items: [], total: 0 })
  )
  const items = data?.items ?? []
  const total = data?.total ?? 0

  const staff = useCachedQuery(STAFF_KEY, () => adminApiService.getRestaurantStaff())
  const methods = useCachedQuery(PAYMENT_METHODS_KEY, () => adminApiService.getRestaurantPaymentMethods())

  // Totals by payment method across every matching sale, not just the current page
  const summaryFilters: ReportFilters = { from: f.from, to: f.to, staffId, serviceNumber: serviceNumber || undefined, methodCode: methodCode || undefined, groupBy: 'Day' }
  const collections = useCachedQuery(reportKey('breakdown-sales-totals', summaryFilters), () =>
    valid ? adminApiService.getReportCollections(summaryFilters) : Promise.resolve([])
  )
  const methodTotals = useMemo(() => {
    const byCode = new Map<string, { expected: number; declared: number; variance: number }>()
    for (const r of collections.data ?? []) {
      const cur = byCode.get(r.methodCode) ?? { expected: 0, declared: 0, variance: 0 }
      cur.expected += r.expected; cur.declared += r.declared; cur.variance += r.variance
      byCode.set(r.methodCode, cur)
    }
    const order = [...(methods.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder).map(m => m.code)
    const codes = [...order.filter(c => byCode.has(c)), ...[...byCode.keys()].filter(c => !order.includes(c)).sort()]
    return codes.map(code => ({ code, name: methods.data?.find(m => m.code === code)?.name ?? code, ...byCode.get(code)! }))
  }, [collections.data, methods.data])
  const grandTotal = methodTotals.reduce((a, m) => ({ expected: a.expected + m.expected, declared: a.declared + m.declared, variance: a.variance + m.variance }), { expected: 0, declared: 0, variance: 0 })
  // Trip names come from the trips list (type + service number, route or origin/destination);
  // sales only carry the service number and route, which is the fallback.
  const tripQuery = { from: '2000-01-01', to: '2099-12-31', page: 1, pageSize: 200 }
  const trips = useCachedQuery(tripsKey(tripQuery), () => adminApiService.getTripsPage(tripQuery))
  const tripOptions = useMemo(() => {
    const seen = new Set<string>()
    return (trips.data?.items ?? []).filter(t => !seen.has(t.serviceNumber) && !!seen.add(t.serviceNumber))
  }, [trips.data])
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

  // ---- Export (CSV / PDF), covering every matching sale, not just the current page ----
  const [exporting, setExporting] = useState<'Csv' | 'Pdf' | null>(null)
  const [exportRows, setExportRows] = useState<TransactionRow[]>([])
  const exportRef = useRef<HTMLDivElement>(null)
  const subtitle = `${groupBy}: ${label}${groupBy !== 'Day' && f.from ? ` · ${f.from} to ${f.to}` : ''}`

  // Readable labels for every filter currently applied, for the exported PDF
  const activeFilters = [
    { label: 'Period', value: `${f.from} to ${f.to}` },
    staffId ? { label: 'Waiter', value: (staff.data ?? []).find(s => String(s.id) === String(staffId))?.fullName ?? staffId } : null,
    serviceNumber ? { label: 'Trip', value: (() => {
      const t = tripOptions.find(x => x.serviceNumber === serviceNumber)
      return t ? `${t.serviceType} ${t.serviceNumber}` : serviceNumber
    })() } : null,
    methodCode ? { label: 'Payment method', value: (methods.data ?? []).find(m => m.code === methodCode)?.name ?? methodCode } : null,
  ].filter((x): x is { label: string; value: string } => !!x)

  const fetchAllRows = async (): Promise<TransactionRow[]> => {
    if (!valid || total <= 0) return []
    const all = await adminApiService.getReportTransactions({ ...f, page: 1, pageSize: total })
    return all.items
  }

  const exportCsv = async () => {
    setExporting('Csv')
    try {
      const rows = await fetchAllRows()
      const headers = ['Receipt', 'Reference', 'Sale time', 'Staff', 'Staff #', 'Trip', 'Seat / table', 'Items', 'Total', 'Refunded', 'Status', 'Methods']
      const body = rows.map(t => {
        const { name, detail } = tripName(t)
        return [
          t.receiptNumber, t.saleReference, when(t.occurredAtUtc), t.staffName, t.staffNumber,
          [name, detail].filter(Boolean).join(' - ') || '—', t.seatNumber || t.tableNumber || '—',
          t.itemCount, t.total.toFixed(2), t.refundedAmount.toFixed(2), t.status, t.paymentMethods || '—',
        ].map(escapeCSV)
      })
      const totalsSection = [
        [],
        ['Payment method', 'Total'],
        ...methodTotals.map(m => [escapeCSV(m.name), m.declared.toFixed(2)]),
        ['Total', grandTotal.declared.toFixed(2)],
      ]
      const csv = [headers.map(escapeCSV), ...body, ...totalsSection].map(r => r.join(',')).join('\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sales-${label}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  const exportPdf = async () => {
    setExporting('Pdf')
    try {
      const rows = await fetchAllRows()
      flushSync(() => setExportRows(rows))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (exportRef.current) {
        await exportElementToPdf(exportRef.current, `sales-${label}.pdf`, {
          header: { title: `Sales · ${label}`, subtitle: `${subtitle} · ${rows.length} sale${rows.length === 1 ? '' : 's'}`, logoUrl: '/nas.png' },
        })
      }
    } finally {
      setExporting(null)
      setExportRows([])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/restaurant/reports/breakdown'))} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Back">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Sales · {label}</h1>
          <p className="text-xs text-gray-500">{subtitle} · {total} sale{total === 1 ? '' : 's'}</p>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportCsv}
            disabled={!valid || !!exporting}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {exporting === 'Csv' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} CSV
          </button>
          <button
            onClick={exportPdf}
            disabled={!valid || !!exporting}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
          >
            {exporting === 'Pdf' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
          </button>
        </div>
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {valid && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {methodTotals.map(m => (
            <div key={m.code} className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3">
              <div className="text-[11px] font-medium text-gray-500 truncate">{m.name}</div>
              <div className="text-lg font-bold text-gray-900 mt-0.5">{num(m.declared)}</div>
            </div>
          ))}
          <div className="rounded-xl bg-blue-600 shadow-sm px-4 py-3">
            <div className="text-[11px] font-medium text-blue-100">Total</div>
            <div className="text-lg font-bold text-white mt-0.5">{num(grandTotal.declared)}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
        <select
          value={staffId}
          onChange={e => { setStaffId(e.target.value); reset() }}
          disabled={groupBy === 'Staff'}
          className={selectCls}
          aria-label="Waiter"
        >
          <option value="">All waiters</option>
          {(staff.data ?? []).filter(m => m.role === 'Waiter').sort((a, b) => a.fullName.localeCompare(b.fullName)).map(m => (
            <option key={m.id} value={m.id}>{m.fullName} (#{m.staffNumber})</option>
          ))}
        </select>
        <select
          value={serviceNumber}
          onChange={e => { setServiceNumber(e.target.value); reset() }}
          disabled={groupBy === 'Trip'}
          className={selectCls}
          aria-label="Trip"
        >
          <option value="">All trips</option>
          {tripOptions.map(t => (
            <option key={t.id} value={t.serviceNumber}>
              {`${t.serviceType} ${t.serviceNumber} · ${t.route || [t.origin, t.destination].filter(Boolean).join(' → ') || '—'}`}
            </option>
          ))}
        </select>
        <select
          value={methodCode}
          onChange={e => { setMethodCode(e.target.value); reset() }}
          disabled={groupBy === 'Method'}
          className={selectCls}
          aria-label="Payment method"
        >
          <option value="">All payment methods</option>
          {(methods.data ?? []).map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
        </select>
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

      {/* Off-screen snapshot captured for the PDF export: every matching sale, not just the current page */}
      <div ref={exportRef} style={{ position: 'fixed', left: -99999, top: 0, width: 1100, background: '#fff', padding: 16 }}>
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.map(ff => (
            <div key={ff.label} className="text-xs text-gray-700 bg-gray-100 rounded-full px-3 py-1">
              <span className="font-semibold">{ff.label}:</span> {ff.value}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }} className="mb-4">
          {methodTotals.map(m => (
            <div key={m.code} className="rounded-xl bg-white border border-gray-200 px-4 py-3">
              <div className="text-xs font-semibold text-gray-600">{m.name}</div>
              <div className="text-lg font-bold text-gray-900 mt-1">{num(m.declared)}</div>
            </div>
          ))}
          <div className="rounded-xl bg-blue-600 px-4 py-3">
            <div className="text-xs font-semibold text-blue-50">Total</div>
            <div className="text-lg font-bold text-white mt-1">{num(grandTotal.declared)}</div>
          </div>
        </div>
        <table className="w-full text-xs border border-gray-200">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr><Th>Receipt</Th><Th>Sale time</Th><Th>Staff</Th><Th>Trip</Th><Th>Seat / table</Th><Th right>Items</Th><Th right>Total</Th><Th right>Refunded</Th><Th>Status</Th><Th>Methods</Th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {exportRows.map(t => {
              const { name, detail } = tripName(t)
              return (
                <tr key={t.saleId}>
                  <td className="px-3 py-2"><div className="font-medium text-gray-900">{t.receiptNumber}</div><div className="text-[10px] text-gray-400">{t.saleReference}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap">{when(t.occurredAtUtc)}</td>
                  <td className="px-3 py-2">{t.staffName}<div className="text-[10px] text-gray-400">#{t.staffNumber}</div></td>
                  <td className="px-3 py-2">{name || detail || '—'}</td>
                  <td className="px-3 py-2">{t.seatNumber || t.tableNumber || '—'}</td>
                  <td className="px-3 py-2 text-right">{t.itemCount}</td>
                  <td className="px-3 py-2 text-right font-semibold">{num(t.total)}</td>
                  <td className="px-3 py-2 text-right">{num(t.refundedAmount)}</td>
                  <td className="px-3 py-2">{t.status}</td>
                  <td className="px-3 py-2">{t.paymentMethods || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default BreakdownSales
