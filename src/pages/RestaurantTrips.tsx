import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApiService, ShiftScheduleRecord } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { shiftSchedulesKey } from '../services/queryKeys'
import { ArrowLeft, Plus, Search, Edit, RefreshCw, XCircle, Loader2, Ban } from 'lucide-react'

type View = 'active' | 'all' | 'available'

const VIEWS: Array<{ id: View; label: string; hint: string }> = [
  { id: 'active', label: 'Active', hint: 'Shifts currently in use' },
  { id: 'all', label: 'All (incl. deactivated)', hint: 'Deactivated shifts keep their history' },
  { id: 'available', label: 'Available now', hint: 'What a waiter sees in the POS shift picker' },
]

const inputCls = 'mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs'
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '—')
// The API binds times to .NET TimeOnly, which needs HH:mm:ss (a bare HH:mm is rejected).
const withSeconds = (t: string) => (t.length === 5 ? `${t}:00` : t)

// Minutes between start and end, wrapping past midnight for overnight shifts.
const durationLabel = (start: string, end: string) => {
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
  if (!start || !end) return '—'
  let diff = toMin(end) - toMin(start)
  if (diff <= 0) diff += 24 * 60
  const h = Math.floor(diff / 60), m = diff % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
const isOvernight = (s: string, e: string) => !!s && !!e && e <= s

const ActiveBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
    {active ? 'Active' : 'Deactivated'}
  </span>
)

// ---- Create / edit ----
const ShiftModal: React.FC<{ shift: ShiftScheduleRecord | null; onClose: () => void; onSaved: () => void }> = ({ shift, onClose, onSaved }) => {
  const [form, setForm] = useState({
    serviceNumber: shift?.serviceNumber ?? '',
    tripCode: shift?.tripCode ?? '',
    origin: shift?.origin ?? '',
    destination: shift?.destination ?? '',
    departureTime: shift ? hhmm(shift.departureTime) : '22:00',
    arrivalTime: shift ? hhmm(shift.arrivalTime) : '06:00',
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
    if (!form.serviceNumber.trim() || !form.tripCode.trim() || !form.origin.trim() || !form.destination.trim() || !form.departureTime || !form.arrivalTime) {
      setError('All fields are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        serviceNumber: form.serviceNumber.trim(),
        tripCode: form.tripCode.trim(),
        origin: form.origin.trim().toUpperCase(),
        destination: form.destination.trim().toUpperCase(),
        departureTime: withSeconds(form.departureTime),
        arrivalTime: withSeconds(form.arrivalTime),
      }
      if (shift) await adminApiService.updateShiftSchedule(shift.id, payload)
      else await adminApiService.createShiftSchedule(payload)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save shift')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">{shift ? `Edit ${shift.serviceNumber} · ${shift.tripCode}` : 'New trip schedule'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="h-4 w-4" /></button>
        </div>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-2 py-1.5">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-700">
            Service number
            <input className={inputCls} value={form.serviceNumber} onChange={e => set('serviceNumber', e.target.value)} placeholder="e.g. TRAIN 05" autoFocus />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Trip code
            <input className={inputCls} value={form.tripCode} onChange={e => set('tripCode', e.target.value)} placeholder="e.g. E4" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-700">
            Origin
            <input className={inputCls} value={form.origin} onChange={e => set('origin', e.target.value)} placeholder="NAIROBI" />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Destination
            <input className={inputCls} value={form.destination} onChange={e => set('destination', e.target.value)} placeholder="MOMBASA" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-700">
            Departure time
            <input type="time" className={inputCls} value={form.departureTime} onChange={e => set('departureTime', e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Arrival time
            <input type="time" className={inputCls} value={form.arrivalTime} onChange={e => set('arrivalTime', e.target.value)} />
          </label>
        </div>
        <p className="text-[11px] text-gray-500">
          Journey: <span className="font-medium text-gray-700">{durationLabel(form.departureTime, form.arrivalTime)}</span>
          {isOvernight(form.departureTime, form.arrivalTime) && ' · arrives next day'}
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700">Cancel</button>
          <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {shift ? 'Save changes' : 'Create shift'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---- Page ----
const RestaurantTrips: React.FC = () => {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('active')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ shift: ShiftScheduleRecord | null } | null>(null)
  const [confirm, setConfirm] = useState<ShiftScheduleRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const { data, loading, refreshing, error, refetch } = useCachedQuery(shiftSchedulesKey(view !== 'all', view === 'available'), () =>
    view === 'available' ? adminApiService.getAvailableShiftSchedules() : adminApiService.getShiftSchedules(view === 'active')
  )

  const items = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = [...(data ?? [])].sort((a, b) => (a.departureTime ?? '').localeCompare(b.departureTime ?? ''))
    return q ? list.filter(s => [s.serviceNumber, s.tripCode, s.origin, s.destination].some(v => (v ?? '').toLowerCase().includes(q))) : list
  }, [data, search])

  const deactivate = async () => {
    if (!confirm) return
    setBusy(true)
    setActionError('')
    try {
      await adminApiService.deactivateShiftSchedule(confirm.id)
      setConfirm(null)
      refetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to deactivate shift')
    } finally {
      setBusy(false)
    }
  }

  const current = VIEWS.find(v => v.id === view)!

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Shift schedules</h1>
        <span className="text-xs text-gray-500">{items.length} shown</span>
        <div className="flex-1" />
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={() => setModal({ shift: null })} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
          <Plus className="h-3.5 w-3.5" /> New shift
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${view === v.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="relative w-52">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
          <input className="w-full border border-gray-300 rounded-lg pl-7 pr-2 py-1.5 text-xs" placeholder="Search service, code, route" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-[11px] text-gray-500">{current.hint}</span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Service</th>
                <th className="px-3 py-2 font-semibold">Trip code</th>
                <th className="px-3 py-2 font-semibold">Origin</th>
                <th className="px-3 py-2 font-semibold">Destination</th>
                <th className="px-3 py-2 font-semibold">Departure</th>
                <th className="px-3 py-2 font-semibold">Arrival</th>
                <th className="px-3 py-2 font-semibold">Journey</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">No trips found.</td></tr>
              ) : items.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 ${s.isActive === false ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{s.serviceNumber}</td>
                  <td className="px-3 py-2 text-gray-700">{s.tripCode}</td>
                  <td className="px-3 py-2 text-gray-700">{s.origin}</td>
                  <td className="px-3 py-2 text-gray-700">{s.destination}</td>
                  <td className="px-3 py-2 tabular-nums">{hhmm(s.departureTime)}</td>
                  <td className="px-3 py-2 tabular-nums">{hhmm(s.arrivalTime)}{isOvernight(s.departureTime, s.arrivalTime) && <span className="ml-1 text-[10px] text-gray-400">+1d</span>}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{durationLabel(s.departureTime, s.arrivalTime)}</td>
                  <td className="px-3 py-2"><ActiveBadge active={s.isActive !== false} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setModal({ shift: s })} className="p-1 rounded hover:bg-gray-100" title="Edit"><Edit className="h-3.5 w-3.5 text-gray-600" /></button>
                    {s.isActive !== false && view !== 'available' && (
                      <button onClick={() => { setActionError(''); setConfirm(s) }} className="p-1 rounded hover:bg-red-50" title="Deactivate"><Ban className="h-3.5 w-3.5 text-red-600" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-900">Deactivate {confirm.serviceNumber} · {confirm.tripCode}?</h2>
            <p className="text-xs text-gray-600">It will no longer appear in the POS shift picker. Existing shift history is kept.</p>
            {actionError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-2 py-1.5">{actionError}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700">Cancel</button>
              <button onClick={deactivate} disabled={busy} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                {busy && <Loader2 className="h-3 w-3 animate-spin" />} Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && <ShiftModal shift={modal.shift} onClose={() => setModal(null)} onSaved={() => { setModal(null); refetch() }} />}
    </div>
  )
}

export default RestaurantTrips
