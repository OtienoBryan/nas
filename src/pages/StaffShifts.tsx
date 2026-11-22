import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApiService, ShiftDetail, ShiftReportRow } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { shiftKey, shiftReportKey, SHIFT_CURRENT_KEY, STAFF_KEY } from '../services/queryKeys'
import Pagination from '../components/ui/Pagination'
import { ArrowLeft, RefreshCw, Search, Loader2, XCircle, Eye, AlertTriangle } from 'lucide-react'

const num = (n: number | null | undefined) =>
  Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

const STATUS_STYLES: Record<string, string> = {
  Open: 'bg-green-100 text-green-700',
  Submitted: 'bg-blue-100 text-blue-700',
  Approved: 'bg-emerald-100 text-emerald-700',
  Closed: 'bg-gray-100 text-gray-600',
}
const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[status] ?? 'bg-amber-100 text-amber-700'}`}>{status}</span>
)

const Th: React.FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-3 py-2 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>
)

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-xs font-bold text-gray-800 mb-2">{title}</h3>
    <div className="border border-gray-200 rounded-xl overflow-x-auto">{children}</div>
  </div>
)

// ---- Detail of one shift (shared by "current shift" and "get a shift") ----
const ShiftSummary: React.FC<{ d: ShiftDetail }> = ({ d }) => {
  const s = d.shift
  const cur = d.currency ? `${d.currency} ` : ''
  const stats = [
    { label: 'Sales', value: String(d.saleCount) },
    { label: 'Gross sales', value: cur + num(d.grossSales) },
    { label: 'Voids', value: cur + num(d.voidTotal) },
    { label: 'Refunds', value: cur + num(d.refundTotal) },
    { label: 'Net sales', value: cur + num(d.netSales) },
    { label: 'Opening float', value: cur + num(d.openingFloat) },
    { label: 'Paid outs', value: cur + num(d.paidOuts) },
    { label: 'Deposits / remittances', value: cur + num(d.depositsAndRemittances) },
    { label: 'Expected cash', value: cur + num(d.expectedCash) },
    { label: 'Pending electronic', value: cur + num(d.pendingElectronic) },
    { label: 'Total expected', value: cur + num(d.totalExpected) },
    { label: 'Total declared', value: cur + num(d.totalDeclared) },
  ]
  const variance = d.totalVariance ?? 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm font-bold text-gray-900">{s.staffName} <span className="font-normal text-gray-500">· #{s.staffNumber}</span></div>
          <div className="text-xs text-gray-500">Device {s.deviceCode || '—'}{s.startedOffline ? ' · started offline' : ''}</div>
        </div>
        <StatusBadge status={s.status} />
        {s.requiresReview && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
            <AlertTriangle className="h-3 w-3" /> Needs review
          </span>
        )}
        {s.reopenCount > 0 && <span className="text-[11px] text-gray-500">Reopened {s.reopenCount}×</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-xs">
        {[
          ['Service', `${s.serviceType}${s.serviceNumber ? ` ${s.serviceNumber}` : ''}`],
          ['Route', s.route || '—'],
          ['Service date', day(s.serviceDate)],
          ['Trip id', s.serviceTripId || '—'],
          ['Started', when(s.startedAtUtc)],
          ['Ended', s.endedAtUtc ? when(s.endedAtUtc) : 'Still open'],
          ['Reviewed by', s.reviewedBy || '—'],
          ['Reviewed at', when(s.reviewedAtUtc)],
        ].map(([k, v]) => (
          <div key={k}><span className="text-gray-400">{k}</span><div className="text-gray-800 font-medium break-all">{v}</div></div>
        ))}
      </div>

      {(s.reviewReason || s.closingComment) && (
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          {s.reviewReason && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3"><div className="font-bold text-amber-800 mb-0.5">Review reason</div>{s.reviewReason}</div>}
          {s.closingComment && <div className="bg-gray-50 border border-gray-200 rounded-lg p-3"><div className="font-bold text-gray-700 mb-0.5">Closing comment</div>{s.closingComment}</div>}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {stats.map(x => (
          <div key={x.label} className="rounded-xl bg-gray-50 px-3 py-2.5">
            <div className="text-[10px] font-medium text-gray-500">{x.label}</div>
            <div className="text-sm font-bold text-gray-900 mt-0.5">{x.value}</div>
          </div>
        ))}
        <div className={`rounded-xl px-3 py-2.5 ${variance === 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="text-[10px] font-medium text-gray-500">Total variance</div>
          <div className={`text-sm font-bold mt-0.5 ${variance === 0 ? 'text-green-700' : 'text-red-700'}`}>{cur}{num(variance)}</div>
        </div>
      </div>

      <Section title="Payment methods">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr><Th>Method</Th><Th>Kind</Th><Th right>Recorded</Th><Th right>Confirmed</Th><Th right>Pending</Th><Th right>Failed</Th><Th right>Refunds</Th><Th right>Expected</Th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {d.methods.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-400">No payments recorded.</td></tr>
            ) : d.methods.map(m => (
              <tr key={m.methodCode}>
                <td className="px-3 py-2 font-medium">{m.methodCode}</td>
                <td className="px-3 py-2 text-gray-600">{m.kind}</td>
                <td className="px-3 py-2 text-right">{num(m.recorded)}</td>
                <td className="px-3 py-2 text-right">{num(m.confirmed)}</td>
                <td className="px-3 py-2 text-right">{num(m.pending)}</td>
                <td className="px-3 py-2 text-right">{num(m.failed)}</td>
                <td className="px-3 py-2 text-right">{num(m.refunds)}</td>
                <td className="px-3 py-2 text-right font-semibold">{num(m.expected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Declarations">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr><Th>Method</Th><Th right>Expected</Th><Th right>Declared</Th><Th right>Variance</Th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {d.declarations.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">Nothing declared yet.</td></tr>
            ) : d.declarations.map(x => (
              <tr key={x.methodCode}>
                <td className="px-3 py-2 font-medium">{x.methodCode}</td>
                <td className="px-3 py-2 text-right">{num(x.expected)}</td>
                <td className="px-3 py-2 text-right">{num(x.declared)}</td>
                <td className={`px-3 py-2 text-right font-semibold ${x.variance === 0 ? 'text-green-600' : 'text-red-600'}`}>{num(x.variance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Cash movements">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr><Th>Type</Th><Th right>Amount</Th><Th>Reason</Th><Th>Reference</Th><Th>When</Th><Th>Offline</Th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {d.cashMovements.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">No cash movements.</td></tr>
            ) : d.cashMovements.map(c => (
              <tr key={c.id}>
                <td className="px-3 py-2 font-medium">{c.type}</td>
                <td className="px-3 py-2 text-right">{num(c.amount)}</td>
                <td className="px-3 py-2 text-gray-600">{c.reason || '—'}</td>
                <td className="px-3 py-2 text-gray-600">{c.reference || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{when(c.occurredAtUtc)}</td>
                <td className="px-3 py-2">{c.capturedOffline ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  )
}

const ShiftModal: React.FC<{ shiftId: string; onClose: () => void }> = ({ shiftId, onClose }) => {
  const { data, loading, error } = useCachedQuery<ShiftDetail>(shiftKey(shiftId), () => adminApiService.getShift(shiftId))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Shift details</h2>
            <p className="text-[11px] font-mono text-gray-500">{shiftId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close"><XCircle className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-10 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>
          ) : data ? (
            <ShiftSummary d={data} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ---- Date range helpers (local calendar days, YYYY-MM-DD) ----
const MAX_DAYS = 366
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d) }
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000)

const PRESETS: Array<{ label: string; range: () => [string, string] }> = [
  { label: 'Today', range: () => [daysAgo(0), daysAgo(0)] },
  { label: 'Last 7 days', range: () => [daysAgo(6), daysAgo(0)] },
  { label: 'Last 30 days', range: () => [daysAgo(29), daysAgo(0)] },
  { label: 'This month', range: () => { const d = new Date(); return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), daysAgo(0)] } },
  // The API allows at most 366 days per request, so "all" means the last year
  { label: 'All (last year)', range: () => [daysAgo(MAX_DAYS - 1), daysAgo(0)] },
]

// ---- Page ----
const StaffShifts: React.FC = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [from, setFrom] = useState(() => PRESETS[0].range()[0])
  const [to, setTo] = useState(() => PRESETS[0].range()[1])
  const [staffId, setStaffId] = useState('')
  const [lookup, setLookup] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const current = useCachedQuery<ShiftDetail | null>(SHIFT_CURRENT_KEY, () => adminApiService.getCurrentShift())
  const rangeError = !from || !to ? 'Pick both dates' : from > to ? 'From must be on or before To' : daysBetween(from, to) >= MAX_DAYS ? `The range can be at most ${MAX_DAYS} days` : ''
  const list = useCachedQuery(shiftReportKey(from, to, staffId, page, pageSize), () =>
    rangeError ? Promise.resolve({ items: [], total: 0 }) : adminApiService.getShiftReport(from, to, staffId, page, pageSize)
  )
  const staff = useCachedQuery(STAFF_KEY, () => adminApiService.getRestaurantStaff())
  const setRange = (f: string, t: string) => { setFrom(f); setTo(t); setPage(1) }
  const activePreset = PRESETS.findIndex(p => { const [f, t] = p.range(); return f === from && t === to })

  const rows: ShiftReportRow[] = list.data?.items ?? []
  const total = list.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Staff shifts</h1>
        <div className="flex-1" />
        <form
          className="flex items-center gap-2"
          onSubmit={e => { e.preventDefault(); if (lookup.trim()) setOpenId(lookup.trim()) }}
        >
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
            <input
              className="w-72 border border-gray-300 rounded-lg pl-7 pr-2 py-1.5 text-xs font-mono"
              placeholder="Open a shift by id"
              value={lookup}
              onChange={e => setLookup(e.target.value)}
            />
          </div>
          <button type="submit" className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Open</button>
        </form>
        <button
          onClick={() => { current.refetch(); list.refetch() }}
          disabled={current.refreshing || list.refreshing}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 text-gray-600 ${current.refreshing || list.refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Current shift of the signed-in user */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3">My current shift</h2>
        {current.loading ? (
          <div className="py-6 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
        ) : current.error ? (
          <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
            {current.error}
            <div className="text-[11px] text-gray-400 mt-0.5">Only staff who run shifts (e.g. waiters) have a current shift of their own.</div>
          </div>
        ) : current.data ? (
          <ShiftSummary d={current.data} />
        ) : (
          <div className="text-xs text-gray-500">You have no open shift.</div>
        )}
      </div>

      {/* All shifts (from the shifts report) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100">
          <div className="text-sm font-bold text-gray-900">All shifts <span className="font-normal text-gray-500">({total})</span></div>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setRange(...p.range())}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${activePreset === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={staffId}
            onChange={e => { setStaffId(e.target.value); setPage(1) }}
            className="border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700"
            aria-label="Filter by staff"
          >
            <option value="">All staff</option>
            {(staff.data ?? []).filter(m => m.role === 'Waiter').sort((a, b) => a.fullName.localeCompare(b.fullName)).map(m => (
              <option key={m.id} value={m.id}>{m.fullName} (#{m.staffNumber})</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <label className="flex items-center gap-1">From
              <input type="date" max={to || undefined} value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
            </label>
            <label className="flex items-center gap-1">To
              <input type="date" min={from || undefined} value={to} onChange={e => { setTo(e.target.value); setPage(1) }} className="border border-gray-300 rounded-lg px-2 py-1 text-xs" />
            </label>
          </div>
        </div>
        {rangeError && <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-5 py-2">{rangeError}</div>}
        {list.error && <div className="bg-red-50 border-b border-red-200 text-red-700 text-xs px-5 py-2">{list.error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <Th>Staff</Th><Th>Service</Th><Th>Date</Th><Th>Started</Th><Th>Ended</Th><Th>Status</Th>
                <Th right>Sales</Th><Th right>Net sales</Th><Th right>Expected</Th><Th right>Declared</Th><Th right>Variance</Th><Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.loading ? (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-400">No shifts found for this period.</td></tr>
              ) : rows.map(r => (
                <tr key={r.shiftId} className="hover:bg-gray-50">
                  <td className="px-3 py-2"><div className="font-medium text-gray-900">{r.staffName}</div><div className="text-[10px] text-gray-500">#{r.staffNumber}</div></td>
                  <td className="px-3 py-2 text-gray-600">{r.serviceNumber || '—'}{r.route ? <div className="text-[10px] text-gray-400">{r.route}</div> : null}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{day(r.serviceDate)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{when(r.startedAtUtc)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.endedAtUtc ? when(r.endedAtUtc) : '—'}</td>
                  <td className="px-3 py-2"><StatusBadge status={r.status} />{r.requiresReview && <span title="Needs review" className="ml-1 text-amber-600">⚠</span>}</td>
                  <td className="px-3 py-2 text-right">{r.saleCount}</td>
                  <td className="px-3 py-2 text-right">{num(r.netSales)}</td>
                  <td className="px-3 py-2 text-right">{num(r.expectedTotal)}</td>
                  <td className="px-3 py-2 text-right">{num(r.declaredTotal)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${r.varianceTotal === 0 ? 'text-green-600' : 'text-red-600'}`}>{num(r.varianceTotal)}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setOpenId(r.shiftId)} className="p-1 rounded hover:bg-gray-100" title="View shift"><Eye className="h-3.5 w-3.5 text-gray-600" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={page}
          totalPages={pages}
          totalItems={total}
          itemsPerPage={pageSize}
          onPageChange={setPage}
          onItemsPerPageChange={n => { setPageSize(n); setPage(1) }}
        />
      </div>

      {openId && <ShiftModal shiftId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

export default StaffShifts
