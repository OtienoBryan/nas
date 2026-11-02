import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApiService } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { PAYMENT_METHODS_KEY, reportKey, STAFF_KEY } from '../services/queryKeys'
import { DATE_PRESETS, rangeError } from '../utils/dateRange'
import Pagination from '../components/ui/Pagination'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

type Metric = 'declared' | 'expected' | 'variance'

const METRICS: Array<{ value: Metric; label: string }> = [
  { value: 'declared', label: 'Declared' },
  { value: 'expected', label: 'Expected' },
  { value: 'variance', label: 'Variance' },
]

const num = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dayLabel = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
const selectCls = 'border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white'

interface Cell { expected: number; declared: number; variance: number }
const EMPTY: Cell = { expected: 0, declared: 0, variance: 0 }
const add = (a: Cell, b: Cell): Cell => ({ expected: a.expected + b.expected, declared: a.declared + b.declared, variance: a.variance + b.variance })

const PaymentCollections: React.FC = () => {
  const navigate = useNavigate()
  const [[from, to], setRange] = useState<[string, string]>(DATE_PRESETS[3].range()) // this month
  const [staffId, setStaffId] = useState('')
  const [metric, setMetric] = useState<Metric>('declared')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const error = rangeError(from, to)
  const filters = { from, to, staffId, groupBy: 'Day' }
  const { data, loading, refreshing, error: loadError, refetch } = useCachedQuery(reportKey('payment-collections', filters), () =>
    error ? Promise.resolve([]) : adminApiService.getReportCollections(filters)
  )
  const methods = useCachedQuery(PAYMENT_METHODS_KEY, () => adminApiService.getRestaurantPaymentMethods())
  const staff = useCachedQuery(STAFF_KEY, () => adminApiService.getRestaurantStaff())

  // One row per date, one column per payment method
  const { days, codes, cells, colTotals, grand } = useMemo(() => {
    const byDay = new Map<string, Map<string, Cell>>()
    const seen = new Set<string>()
    for (const r of data ?? []) {
      const day = r.groupKey.slice(0, 10)
      seen.add(r.methodCode)
      const row = byDay.get(day) ?? new Map<string, Cell>()
      row.set(r.methodCode, add(row.get(r.methodCode) ?? EMPTY, r))
      byDay.set(day, row)
    }
    // Every active payment method gets a column (in its configured order), even with no collections;
    // inactive methods and codes missing from the list only appear when the data has them
    const sorted = [...(methods.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
    const order = sorted.map(m => m.code)
    const codes = [
      ...sorted.filter(m => m.isActive || seen.has(m.code)).map(m => m.code),
      ...[...seen].filter(c => !order.includes(c)).sort(),
    ]
    const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a)) // newest first
    const colTotals = new Map<string, Cell>(codes.map(c => [c, days.reduce((acc, d) => add(acc, byDay.get(d)?.get(c) ?? EMPTY), EMPTY)]))
    const grand = [...colTotals.values()].reduce(add, EMPTY)
    return { days, codes, cells: byDay, colTotals, grand }
  }, [data, methods.data])

  const nameOf = (code: string) => methods.data?.find(m => m.code === code)?.name ?? code
  // Open the payments behind a figure: a date x method cell, a whole day, or a method across the period
  const openPayments = (date: string, method: string) =>
    navigate(`/restaurant/collections/payments?${new URLSearchParams({ date, method, from, to, staffId })}`)
  const rowTotal = (d: string) => codes.reduce((acc, c) => add(acc, cells.get(d)?.get(c) ?? EMPTY), EMPTY)

  const pages = Math.max(1, Math.ceil(days.length / pageSize))
  const current = Math.min(page, pages)
  const visibleDays = days.slice((current - 1) * pageSize, current * pageSize)

  const show = (c: Cell | undefined) => {
    const v = c?.[metric] ?? 0
    if (!c || (c.expected === 0 && c.declared === 0 && c.variance === 0)) return <span className="text-gray-300">—</span>
    return <span className={metric === 'variance' && v !== 0 ? 'text-red-600 font-semibold' : ''}>{num(v)}</span>
  }
  const tip = (c: Cell | undefined) => (c ? `Expected ${num(c.expected)} · Declared ${num(c.declared)} · Variance ${num(c.variance)}` : '')

  const tiles = [
    ['Expected', num(grand.expected), 'text-gray-900'],
    ['Declared', num(grand.declared), 'text-gray-900'],
    ['Variance', num(grand.variance), grand.variance === 0 ? 'text-green-700' : 'text-red-600'],
    ['Days with collections', String(days.length), 'text-gray-900'],
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Payments summary</h1>
          <p className="text-[11px] text-gray-500">Collections by payment method for each date (submitted shifts)</p>
        </div>
        <div className="flex-1" />
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map(p => {
            const [f, t] = p.range()
            const on = f === from && t === to
            return (
              <button
                key={p.label}
                onClick={() => { setRange([f, t]); setPage(1) }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-600">From
          <input type="date" max={to || undefined} value={from} onChange={e => { setRange([e.target.value, to]); setPage(1) }} className={selectCls} />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">To
          <input type="date" min={from || undefined} value={to} onChange={e => { setRange([from, e.target.value]); setPage(1) }} className={selectCls} />
        </label>
        <select value={staffId} onChange={e => { setStaffId(e.target.value); setPage(1) }} className={selectCls} aria-label="Staff">
          <option value="">All waiters</option>
          {(staff.data ?? []).filter(m => m.role === 'Waiter').sort((a, b) => a.fullName.localeCompare(b.fullName)).map(m => (
            <option key={m.id} value={m.id}>{m.fullName} (#{m.staffNumber})</option>
          ))}
        </select>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-medium" role="group" aria-label="Show">
          {METRICS.map(m => (
            <button key={m.value} onClick={() => setMetric(m.value)} className={`px-2.5 py-1 ${metric === m.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>{m.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-4 py-2">{error}</div>}
      {loadError && !error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">{loadError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(([k, v, tone]) => (
          <div key={k} className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3">
            <div className="text-[11px] font-medium text-gray-500">{k}</div>
            <div className={`text-base font-bold mt-0.5 ${tone}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Date</th>
                {codes.map(c => <th key={c} className="px-3 py-2 font-semibold text-right whitespace-nowrap" title={c}>{nameOf(c)}</th>)}
                <th className="px-3 py-2 font-semibold text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={codes.length + 2} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
              ) : visibleDays.length === 0 ? (
                <tr><td colSpan={codes.length + 2} className="px-3 py-8 text-center text-gray-400">No collections for this period.</td></tr>
              ) : visibleDays.map(d => (
                <tr key={d} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{dayLabel(d)}</td>
                  {codes.map(c => {
                    const cell = cells.get(d)?.get(c)
                    return (
                      <td key={c} className={`px-3 py-2 text-right ${cell ? 'cursor-pointer hover:bg-blue-50' : ''}`} title={cell ? `${tip(cell)} · click for the payments` : ''} onClick={() => cell && openPayments(d, c)}>
                        {show(cell)}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right font-semibold cursor-pointer hover:bg-blue-50" title={`${tip(rowTotal(d))} · click for the payments`} onClick={() => openPayments(d, '')}>{show(rowTotal(d))}</td>
                </tr>
              ))}
            </tbody>
            {days.length > 0 && (
              <tfoot className="bg-gray-50 font-bold text-gray-900">
                <tr>
                  <td className="px-3 py-2">Total ({days.length} day{days.length === 1 ? '' : 's'})</td>
                  {codes.map(c => <td key={c} className="px-3 py-2 text-right cursor-pointer hover:bg-blue-100" title={`${tip(colTotals.get(c))} · click for the payments`} onClick={() => openPayments('', c)}>{show(colTotals.get(c))}</td>)}
                  <td className="px-3 py-2 text-right" title={tip(grand)}>{show(grand)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <Pagination
          currentPage={current}
          totalPages={pages}
          totalItems={days.length}
          itemsPerPage={pageSize}
          onPageChange={setPage}
          onItemsPerPageChange={n => { setPageSize(n); setPage(1) }}
        />
      </div>

      <p className="text-[11px] text-gray-500">
        Figures come from the collections report, which counts shifts that have been submitted. Sales from a shift that is still open appear here once it is closed. Hover a figure to see expected, declared and variance, or click it to see the payments behind it.
      </p>
    </div>
  )
}

export default PaymentCollections
