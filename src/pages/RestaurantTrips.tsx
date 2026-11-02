import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApiService, TripInput, TripRecord } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { tripsKey } from '../services/queryKeys'
import { daysAgo, ymd } from '../utils/dateRange'
import Pagination from '../components/ui/Pagination'
import { ArrowLeft, Plus, Search, Edit, RefreshCw, XCircle, Loader2 } from 'lucide-react'


const SERVICE_TYPES = ['Train', 'Flight', 'Other']
const STATUSES = ['Scheduled', 'InService', 'Completed', 'Cancelled']
const STATUS_LABEL: Record<string, string> = { Scheduled: 'Scheduled', InService: 'In service', Completed: 'Completed', Cancelled: 'Cancelled' }
const STATUS_STYLE: Record<string, string> = {
  Scheduled: 'bg-blue-100 text-blue-700',
  InService: 'bg-green-100 text-green-700',
  Completed: 'bg-gray-100 text-gray-600',
  Cancelled: 'bg-red-100 text-red-700',
}

const inputCls = 'mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs'
const selectCls = 'border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700'
const day = (iso?: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '—')

// Date presets for the list. "All dates" is the default so no trip is hidden by the window.
const today = () => daysAgo(0)
const PRESETS: Array<{ label: string; range: () => [string, string] }> = [
  { label: 'All dates', range: () => ['2000-01-01', '2099-12-31'] },
  { label: 'Today', range: () => [today(), today()] },
  { label: 'Upcoming', range: () => [today(), '2099-12-31'] },
  { label: 'This month', range: () => { const d = new Date(); return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))] } },
  { label: 'Last 30 days', range: () => [daysAgo(29), today()] },
]

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[status] ?? 'bg-amber-100 text-amber-700'}`}>{STATUS_LABEL[status] ?? status}</span>
)

// ---- Create / edit ----
const TripModal: React.FC<{ trip: TripRecord | null; onClose: () => void; onSaved: () => void }> = ({ trip, onClose, onSaved }) => {
  const [form, setForm] = useState({
    serviceType: trip?.serviceType ?? 'Train',
    serviceNumber: trip?.serviceNumber ?? '',
    serviceDate: trip?.serviceDate?.slice(0, 10) ?? today(),
    route: trip?.route ?? '',
    origin: trip?.origin ?? '',
    destination: trip?.destination ?? '',
    base: trip?.base ?? '',
    status: trip?.status ?? 'Scheduled',
    notes: trip?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.serviceNumber.trim() || !form.serviceDate) {
      setError('Service number and service date are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload: TripInput = {
        serviceType: form.serviceType,
        serviceNumber: form.serviceNumber.trim(),
        serviceDate: form.serviceDate,
        route: form.route.trim(),
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        base: form.base.trim(),
        status: form.status,
        notes: form.notes.trim(),
      }
      if (trip) await adminApiService.updateTrip(trip.id, payload)
      else await adminApiService.createTrip(payload)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trip')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">{trip ? `Edit trip ${trip.serviceNumber}` : 'New trip'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="h-4 w-4" /></button>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-2 py-1.5">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-700">
            Service type
            <select className={inputCls} value={form.serviceType} onChange={e => set('serviceType', e.target.value)}>
              {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Service number
            <input className={inputCls} value={form.serviceNumber} onChange={e => set('serviceNumber', e.target.value)} placeholder="e.g. 12" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-700">
            Service date
            <input type="date" className={inputCls} value={form.serviceDate} onChange={e => set('serviceDate', e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Status
            <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-xs font-medium text-gray-700">
          Route
          <input className={inputCls} value={form.route} onChange={e => set('route', e.target.value)} placeholder="e.g. Nairobi - Mombasa" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-700">
            Origin
            <input className={inputCls} value={form.origin} onChange={e => set('origin', e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Destination
            <input className={inputCls} value={form.destination} onChange={e => set('destination', e.target.value)} />
          </label>
        </div>
        <label className="block text-xs font-medium text-gray-700">
          Base
          <input className={inputCls} value={form.base} onChange={e => set('base', e.target.value)} />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Notes
          <textarea className={inputCls} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700">Cancel</button>
          <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {trip ? 'Save changes' : 'Create trip'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---- Page ----
const RestaurantTrips: React.FC = () => {
  const navigate = useNavigate()
  const [[from, to], setRange] = useState<[string, string]>(PRESETS[0].range())
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modal, setModal] = useState<{ trip: TripRecord | null } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const dateError = !from || !to ? 'Pick both dates' : from > to ? 'From must be on or before To' : ''
  const query = { from, to, serviceType, status, search: debounced, page, pageSize }
  const { data, loading, refreshing, error, refetch } = useCachedQuery(tripsKey(query), () =>
    dateError ? Promise.resolve({ items: [], total: 0 }) : adminApiService.getTripsPage(query)
  )
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const activePreset = PRESETS.findIndex(p => { const [f, t] = p.range(); return f === from && t === to })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Trips</h1>
        <span className="text-xs text-gray-500">{total} total</span>
        <div className="flex-1" />
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={() => setModal({ trip: null })} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
          <Plus className="h-3.5 w-3.5" /> New trip
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => { setRange(p.range()); setPage(1) }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${activePreset === i ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-600">From
          <input type="date" max={to || undefined} value={from} onChange={e => { setRange([e.target.value, to]); setPage(1) }} className={selectCls} />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">To
          <input type="date" min={from || undefined} value={to} onChange={e => { setRange([from, e.target.value]); setPage(1) }} className={selectCls} />
        </label>
        <div className="relative w-52">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
          <input className="w-full border border-gray-300 rounded-lg pl-7 pr-2 py-1.5 text-xs" placeholder="Search trips" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={selectCls} value={serviceType} onChange={e => { setServiceType(e.target.value); setPage(1) }} aria-label="Service type">
          <option value="">All types</option>
          {SERVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={selectCls} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {dateError && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-4 py-2">{dateError}</div>}
      {error && !dateError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Service</th><th className="px-3 py-2 font-semibold">Date</th><th className="px-3 py-2 font-semibold">Route</th>
                <th className="px-3 py-2 font-semibold">Origin → Destination</th><th className="px-3 py-2 font-semibold">Base</th><th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Notes</th><th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No trips found.</td></tr>
              ) : items.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2"><div className="font-medium text-gray-900">{t.serviceNumber}</div><div className="text-[10px] text-gray-500">{t.serviceType}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap">{day(t.serviceDate)}</td>
                  <td className="px-3 py-2 text-gray-700">{t.route || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{t.origin || t.destination ? `${t.origin || '—'} → ${t.destination || '—'}` : '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{t.base || '—'}</td>
                  <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                  <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate" title={t.notes ?? ''}>{t.notes || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setModal({ trip: t })} className="p-1 rounded hover:bg-gray-100" title="Edit"><Edit className="h-3.5 w-3.5 text-gray-600" /></button>
                  </td>
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

      {modal && <TripModal trip={modal.trip} onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch() }} />}
    </div>
  )
}

export default RestaurantTrips
