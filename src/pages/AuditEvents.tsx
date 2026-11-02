import { useMemo, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearSentAudit, flushAudit, getAuditEntries, getAuditStatus, subscribeAudit } from '../services/audit'
import Pagination from '../components/ui/Pagination'
import { ArrowLeft, Loader2, Send, Trash2 } from 'lucide-react'

const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

const STATUS_STYLE: Record<string, string> = {
  queued: 'bg-amber-100 text-amber-700',
  sent: 'bg-green-100 text-green-700',
  dropped: 'bg-red-100 text-red-700',
}

const AuditEvents: React.FC = () => {
  const navigate = useNavigate()
  const entries = useSyncExternalStore(subscribeAudit, getAuditEntries)
  const status = useSyncExternalStore(subscribeAudit, getAuditStatus)
  const [filter, setFilter] = useState<'all' | 'queued' | 'sent' | 'dropped'>('all')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sending, setSending] = useState(false)

  const actions = useMemo(() => [...new Set(entries.map(e => e.event.action))].sort(), [entries])
  const rows = entries.filter(e => (filter === 'all' || e.status === filter) && (!action || e.event.action === action))
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * pageSize, current * pageSize)

  const sendNow = async () => {
    setSending(true)
    try { await flushAudit(true) } finally { setSending(false) }
  }

  const tiles = [
    ['Waiting to send', status.queued, 'text-amber-700'],
    ['Sent', status.sent, 'text-green-700'],
    ['Rejected', status.dropped, 'text-red-700'],
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Audit</h1>
          <p className="text-[11px] text-gray-500">UI events posted to <code>POST /api/v1/audit/ui-events</code></p>
        </div>
        <div className="flex-1" />
        <button onClick={clearSentAudit} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50" title="Remove events that were already sent or rejected">
          <Trash2 className="h-3.5 w-3.5" /> Clear history
        </button>
        <button onClick={sendNow} disabled={sending || status.queued === 0} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send now
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(([k, v, tone]) => (
          <div key={k} className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3">
            <div className="text-[11px] font-medium text-gray-500">{k}</div>
            <div className={`text-xl font-bold mt-0.5 ${tone}`}>{v}</div>
          </div>
        ))}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3">
          <div className="text-[11px] font-medium text-gray-500">Last sent</div>
          <div className="text-sm font-bold text-gray-900 mt-1.5">{when(status.lastSentAt)}</div>
        </div>
      </div>

      {status.lastError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2.5">
          <div className="font-semibold">{status.lastError}</div>
          <div className="text-[11px] mt-0.5">Events are kept on this device and retried every minute, so nothing is lost. Last attempt {when(status.lastAttemptAt)}.</div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-medium">
          {(['all', 'queued', 'sent', 'dropped'] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1) }} className={`px-2.5 py-1 capitalize ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
              {f === 'queued' ? 'Waiting' : f === 'dropped' ? 'Rejected' : f}
            </button>
          ))}
        </div>
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700" aria-label="Action">
          <option value="">All actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-[11px] text-gray-500">Recorded: saves &amp; logins, exports.</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Time</th><th className="px-3 py-2 font-semibold">Action</th><th className="px-3 py-2 font-semibold">Screen</th>
                <th className="px-3 py-2 font-semibold">Entity</th><th className="px-3 py-2 font-semibold">Outcome</th><th className="px-3 py-2 font-semibold">Details</th><th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No events yet. Use the app and they appear here.</td></tr>
              ) : visible.map(({ event: e, status: st }) => (
                <tr key={e.eventId} className="hover:bg-gray-50 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{when(e.occurredAtUtc)}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{e.action}</td>
                  <td className="px-3 py-2 font-mono text-gray-600">{e.screen}</td>
                  <td className="px-3 py-2 text-gray-600">{e.entityType || '—'}{e.entityId && <div className="text-[10px] font-mono text-gray-400">{e.entityId.slice(0, 8)}…</div>}</td>
                  <td className="px-3 py-2"><span className={e.outcome === 'failure' ? 'text-red-600 font-semibold' : 'text-gray-600'}>{e.outcome || '—'}</span></td>
                  <td className="px-3 py-2 text-gray-600 max-w-[320px] truncate" title={JSON.stringify(e.details)}>
                    {Object.entries(e.details).map(([k, v]) => `${k}: ${String(v)}`).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLE[st]}`}>{st === 'queued' ? 'Waiting' : st === 'dropped' ? 'Rejected' : 'Sent'}</span></td>
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

export default AuditEvents
