import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApiService, StaffRecord } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { invalidateQuery } from '../services/queryCache'
import { STAFF_KEY, staffMemberKey, staffPageKey } from '../services/queryKeys'
import Pagination from '../components/ui/Pagination'
import { ArrowLeft, Plus, Search, Edit, Eye, RefreshCw, XCircle, Loader2, UserCheck, UserX, Shuffle } from 'lucide-react'

const ROLES = ['Waiter', 'Accountant', 'Support']
const inputCls = 'mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs'
const selectCls = 'border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700'
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)
const when = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// Staff changes also affect the name lookups used on other pages
const staffChanged = (id?: string) => {
  invalidateQuery(STAFF_KEY)
  if (id) invalidateQuery(staffMemberKey(id))
}

const RoleBadge: React.FC<{ role: string }> = ({ role }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${role === 'Accountant' ? 'bg-purple-100 text-purple-700' : role === 'Support' ? 'bg-cyan-100 text-cyan-700' : 'bg-blue-100 text-blue-700'}`}>{role}</span>
)
const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{status}</span>
)

const ModalShell: React.FC<{ title: string; onClose: () => void; onSubmit?: (e: React.FormEvent) => void; wide?: boolean; children: React.ReactNode }> = ({
  title, onClose, onSubmit, wide, children,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={onSubmit ?? (e => e.preventDefault())} className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-lg' : 'max-w-sm'} p-5 space-y-3 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><XCircle className="h-4 w-4" /></button>
        </div>
        {children}
      </form>
    </div>
  )
}

const ErrorBox: React.FC<{ message: string }> = ({ message }) =>
  message ? <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-2 py-1.5">{message}</div> : null

const Actions: React.FC<{ onClose: () => void; saving: boolean; label: string; danger?: boolean }> = ({ onClose, saving, label, danger }) => (
  <div className="flex justify-end gap-2 pt-1">
    <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700">Cancel</button>
    <button
      type="submit"
      disabled={saving}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg text-white disabled:opacity-50 flex items-center gap-1 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
    >
      {saving && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </button>
  </div>
)

const randomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(10))
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

// ---- Register / edit ----
const StaffModal: React.FC<{ member: StaffRecord | null; onClose: () => void; onSaved: (created?: { username: string; password: string }) => void }> = ({ member, onClose, onSaved }) => {
  const [form, setForm] = useState({
    staffNumber: member?.staffNumber ?? '',
    fullName: member?.fullName ?? '',
    username: member?.username ?? '',
    phone: member?.phone ?? '',
    email: member?.email ?? '',
    role: member?.role ?? 'Waiter',
    temporaryPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.fullName.trim() || (!member && (!form.staffNumber.trim() || !form.username.trim() || !form.temporaryPassword))) {
      setError(member ? 'Full name is required' : 'Staff number, full name, username and a temporary password are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const common = { fullName: form.fullName.trim(), phone: form.phone.trim(), email: form.email.trim(), role: form.role }
      if (member) {
        await adminApiService.updateStaffMember(member.id, common)
        onSaved()
      } else {
        await adminApiService.createStaffMember({
          ...common,
          staffNumber: form.staffNumber.trim(),
          username: form.username.trim(),
          temporaryPassword: form.temporaryPassword,
        })
        onSaved({ username: form.username.trim(), password: form.temporaryPassword })
      }
    } catch (err) {
      setError(errMsg(err, 'Failed to save staff member'))
      setSaving(false)
    }
  }

  return (
    <ModalShell title={member ? `Edit ${member.fullName}` : 'Register staff'} onClose={onClose} onSubmit={submit} wide>
      <ErrorBox message={error} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-gray-700">
          Staff number
          <input className={`${inputCls} disabled:bg-gray-100`} value={form.staffNumber} disabled={!!member} onChange={e => set('staffNumber', e.target.value)} />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Username
          <input className={`${inputCls} disabled:bg-gray-100`} value={form.username} disabled={!!member} autoComplete="off" onChange={e => set('username', e.target.value)} />
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-700">
        Full name
        <input className={inputCls} value={form.fullName} onChange={e => set('fullName', e.target.value)} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-gray-700">
          Phone
          <input className={inputCls} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+254..." />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Role
          <select className={inputCls} value={form.role} onChange={e => set('role', e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-700">
        Email
        <input type="email" className={inputCls} value={form.email} onChange={e => set('email', e.target.value)} />
      </label>
      {!member && (
        <label className="block text-xs font-medium text-gray-700">
          Temporary password
          <div className="mt-1 flex gap-2">
            <input className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs font-mono" value={form.temporaryPassword} autoComplete="off" onChange={e => set('temporaryPassword', e.target.value)} />
            <button type="button" onClick={() => set('temporaryPassword', randomPassword())} className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
              <Shuffle className="h-3 w-3" /> Generate
            </button>
          </div>
          <span className="block mt-1 text-[11px] font-normal text-gray-500">The staff member must change it at first login.</span>
        </label>
      )}
      <Actions onClose={onClose} saving={saving} label={member ? 'Save changes' : 'Register'} />
    </ModalShell>
  )
}

// ---- Deactivate ----
const DeactivateModal: React.FC<{ member: StaffRecord; onClose: () => void; onSaved: () => void }> = ({ member, onClose, onSaved }) => {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) { setError('A reason is required'); return }
    setSaving(true)
    setError('')
    try {
      await adminApiService.deactivateStaff(member.id, reason.trim())
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Failed to deactivate'))
      setSaving(false)
    }
  }
  return (
    <ModalShell title={`Deactivate ${member.fullName}`} onClose={onClose} onSubmit={submit}>
      <ErrorBox message={error} />
      <p className="text-[11px] text-gray-500">The account is kept (never deleted) and all of its sessions end immediately. It can be activated again later.</p>
      <label className="block text-xs font-medium text-gray-700">
        Reason
        <input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Left the company" autoFocus />
      </label>
      <Actions onClose={onClose} saving={saving} label="Deactivate" danger />
    </ModalShell>
  )
}

// ---- Details ----
const DetailModal: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const { data: m, loading, error } = useCachedQuery<StaffRecord>(staffMemberKey(id), () => adminApiService.getStaffMember(id))
  const rows: Array<[string, React.ReactNode]> = m
    ? [
        ['Staff number', m.staffNumber],
        ['Username', m.username],
        ['Role', <RoleBadge key="r" role={m.role} />],
        ['Status', <StatusBadge key="s" status={m.status} />],
        ['Phone', m.phone || '—'],
        ['Email', m.email || '—'],
        ['Must change password', m.mustChangePassword ? 'Yes' : 'No'],
        ['Last login', when(m.lastLoginAtUtc)],
        ['Locked until', when(m.lockedUntilUtc)],
        ['Created', when(m.createdDate)],
        ...(m.deactivatedAtUtc ? ([['Deactivated', when(m.deactivatedAtUtc)], ['Deactivation reason', m.deactivationReason || '—']] as Array<[string, React.ReactNode]>) : []),
      ]
    : []
  return (
    <ModalShell title={m ? m.fullName : 'Staff member'} onClose={onClose} wide>
      <ErrorBox message={error} />
      {loading ? (
        <div className="py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
          {rows.map(([k, v]) => (
            <div key={k}><dt className="text-gray-400">{k}</dt><dd className="text-gray-800 font-medium break-words">{v}</dd></div>
          ))}
        </dl>
      )}
      <div className="flex justify-end"><button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700">Close</button></div>
    </ModalShell>
  )
}

// ---- Page ----
type ModalState = { kind: 'edit'; member: StaffRecord | null } | { kind: 'deactivate'; member: StaffRecord } | { kind: 'detail'; id: string } | null

const RestaurantStaff: React.FC = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modal, setModal] = useState<ModalState>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const query = { search: debounced, role, status, page, pageSize }
  const { data, loading, refreshing, error, refetch } = useCachedQuery(staffPageKey(query), () => adminApiService.getStaffPage(query))
  const items = data?.items ?? []
  const total = data?.total ?? 0

  const saved = (id?: string) => { staffChanged(id); setModal(null); refetch() }

  const activate = async (m: StaffRecord) => {
    setBusyId(m.id)
    setActionError('')
    try {
      await adminApiService.activateStaff(m.id)
      saved(m.id)
    } catch (err) {
      setActionError(errMsg(err, 'Failed to activate'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Staff</h1>
        <span className="text-xs text-gray-500">{total} total</span>
        <div className="flex-1" />
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={() => setModal({ kind: 'edit', member: null })} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
          <Plus className="h-3.5 w-3.5" /> Register staff
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
          <input className="w-full border border-gray-300 rounded-lg pl-7 pr-2 py-1.5 text-xs" placeholder="Search name, number or username" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={selectCls} value={role} onChange={e => { setRole(e.target.value); setPage(1) }} aria-label="Role">
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className={selectCls} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} aria-label="Status">
          <option value="">Any status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {created && (
        <div className="flex items-start justify-between gap-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg px-4 py-3">
          <div>
            Registered <b>{created.username}</b>. Give them this temporary password (shown once):{' '}
            <code className="px-1.5 py-0.5 bg-white border border-green-200 rounded font-mono select-all">{created.password}</code>
            <div className="text-[11px] mt-0.5">They must change it the first time they sign in.</div>
          </div>
          <button onClick={() => setCreated(null)} className="text-green-700 hover:text-green-900"><XCircle className="h-4 w-4" /></button>
        </div>
      )}
      {(error || actionError) && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error || actionError}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Staff</th><th className="px-3 py-2 font-semibold">Username</th><th className="px-3 py-2 font-semibold">Role</th>
                <th className="px-3 py-2 font-semibold">Phone</th><th className="px-3 py-2 font-semibold">Email</th><th className="px-3 py-2 font-semibold">Last login</th>
                <th className="px-3 py-2 font-semibold">Status</th><th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No staff found.</td></tr>
              ) : items.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2"><div className="font-medium text-gray-900">{m.fullName}</div><div className="text-[10px] text-gray-500">#{m.staffNumber}</div></td>
                  <td className="px-3 py-2 font-mono text-gray-700">{m.username}</td>
                  <td className="px-3 py-2"><RoleBadge role={m.role} /></td>
                  <td className="px-3 py-2 text-gray-600">{m.phone || '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{m.email || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{when(m.lastLoginAtUtc)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={m.status} />
                    {m.mustChangePassword && <div className="text-[10px] text-amber-600 mt-0.5">Password change due</div>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setModal({ kind: 'detail', id: m.id })} className="p-1 rounded hover:bg-gray-100" title="View"><Eye className="h-3.5 w-3.5 text-gray-600" /></button>
                    <button onClick={() => setModal({ kind: 'edit', member: m })} className="p-1 rounded hover:bg-gray-100" title="Edit"><Edit className="h-3.5 w-3.5 text-gray-600" /></button>
                    {m.status === 'Active' ? (
                      <button onClick={() => setModal({ kind: 'deactivate', member: m })} className="p-1 rounded hover:bg-red-50" title="Deactivate"><UserX className="h-3.5 w-3.5 text-red-600" /></button>
                    ) : (
                      <button onClick={() => activate(m)} disabled={busyId === m.id} className="p-1 rounded hover:bg-green-50 disabled:opacity-50" title="Activate">
                        {busyId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5 text-green-600" />}
                      </button>
                    )}
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

      {modal?.kind === 'edit' && (
        <StaffModal
          member={modal.member}
          onClose={() => setModal(null)}
          onSaved={c => { if (c) setCreated(c); saved(modal.member?.id) }}
        />
      )}
      {modal?.kind === 'deactivate' && <DeactivateModal member={modal.member} onClose={() => setModal(null)} onSaved={() => saved(modal.member.id)} />}
      {modal?.kind === 'detail' && <DetailModal id={modal.id} onClose={() => setModal(null)} />}
    </div>
  )
}

export default RestaurantStaff
