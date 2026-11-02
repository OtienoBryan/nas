import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  adminApiService,
  MenuItem,
  MenuItemCreateInput,
  MenuItemListQuery,
  PriceHistoryEntry,
} from '../services/api'
import Pagination from '../components/ui/Pagination'
import CloudinaryUpload from '../components/CloudinaryUpload'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { MENU_CATEGORIES_KEY, STAFF_KEY, menuItemsKey } from '../services/queryKeys'
import { ArrowLeft, Plus, Search, Edit, RefreshCw, XCircle, Loader2, Tag, History } from 'lucide-react'

const money = (n: number) => `Ksh ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inputCls = 'mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs'
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback)

const ModalShell: React.FC<{ title: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; wide?: boolean; children: React.ReactNode }> = ({
  title, onClose, onSubmit, wide, children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <form onSubmit={onSubmit} className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-lg' : 'max-w-sm'} p-5 space-y-3 max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <XCircle className="h-4 w-4" />
        </button>
      </div>
      {children}
    </form>
  </div>
)

const ErrorBox: React.FC<{ message: string }> = ({ message }) =>
  message ? <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-2 py-1.5">{message}</div> : null

const Actions: React.FC<{ onClose: () => void; saving: boolean; label: string }> = ({ onClose, saving, label }) => (
  <div className="flex justify-end gap-2 pt-1">
    <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700">Cancel</button>
    <button
      type="submit"
      disabled={saving}
      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
    >
      {saving && <Loader2 className="h-3 w-3 animate-spin" />}
      {label}
    </button>
  </div>
)

// Item code suggested from the product name: "Soda 300 ml" -> "SODA-300-ML"
const codeFromName = (name: string) =>
  name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20).replace(/-+$/, '')

// ---- Create / edit ----
interface ItemModalProps {
  item: MenuItem | null // null = creating
  categories: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}

const ItemModal: React.FC<ItemModalProps> = ({ item, categories, onClose, onSaved }) => {
  const [form, setForm] = useState({
    itemCode: item?.itemCode ?? '',
    name: item?.name ?? '',
    description: item?.description ?? '',
    imageUrl: item?.imageUrl ?? '',
    categoryId: item?.categoryId ?? categories[0]?.id ?? '',
    price: item ? String(item.price) : '',
    taxRatePercent: item ? String(item.taxRatePercent) : '16',
    isAvailable: item?.isAvailable ?? true,
    isActive: item?.isActive ?? true,
  })
  // The code follows the name until the user types their own code
  const [codeEdited, setCodeEdited] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedWithWarning, setSavedWithWarning] = useState(false)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.categoryId || !form.itemCode.trim() || (!item && form.price === '')) {
      setError(item ? 'Item code, name and category are required' : 'Item code, name, category and price are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const common = {
        name: form.name.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        categoryId: form.categoryId,
      }
      if (item) {
        const code = form.itemCode.trim()
        const codeChanged = code !== item.itemCode
        await adminApiService.updateMenuItem(item.id, { ...common, isActive: form.isActive, ...(codeChanged ? { itemCode: code } : {}) })
        if (codeChanged) {
          // The update endpoint isn't documented to take a code, so confirm the server really changed it
          const fresh = await adminApiService.getMenuItem(item.id)
          if (fresh.itemCode !== code) {
            setError(`The other changes were saved, but the server kept the item code "${fresh.itemCode}": it does not allow the code to be changed.`)
            setSavedWithWarning(true)
            setSaving(false)
            return
          }
        }
      } else {
        const payload: MenuItemCreateInput = {
          ...common,
          itemCode: form.itemCode.trim(),
          price: Number(form.price),
          taxRatePercent: Number(form.taxRatePercent) || 0,
          isAvailable: form.isAvailable,
        }
        await adminApiService.createMenuItem(payload)
      }
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Failed to save product'))
      setSaving(false)
    }
  }

  return (
    <ModalShell title={item ? 'Edit product' : 'New product'} onClose={savedWithWarning ? onSaved : onClose} onSubmit={submit} wide>
      <ErrorBox message={error} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-gray-700">
          Item code
          <input className={inputCls} value={form.itemCode} onChange={e => { setCodeEdited(true); set('itemCode', e.target.value) }} placeholder="e.g. T-TEA" />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Category
          <select className={inputCls} value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-700">
        Name
        <input
          className={inputCls}
          value={form.name}
          onChange={e => {
            const name = e.target.value
            setForm(f => ({ ...f, name, ...(!codeEdited ? { itemCode: codeFromName(name) } : {}) }))
          }}
        />
      </label>
      <label className="block text-xs font-medium text-gray-700">
        Description
        <textarea className={inputCls} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
      </label>
      <div className="text-xs font-medium text-gray-700">
        Image
        <CloudinaryUpload
          className="mt-1"
          folder="restaurant-menu"
          currentImage={form.imageUrl || undefined}
          onUpload={r => set('imageUrl', r.secure_url)}
          onRemove={() => set('imageUrl', '')}
          disabled={saving}
        />
      </div>
      {!item && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-gray-700">
            Price
            <input type="number" min="0" step="0.01" className={inputCls} value={form.price} onChange={e => set('price', e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-gray-700">
            Tax rate %
            <input type="number" min="0" step="0.01" className={inputCls} value={form.taxRatePercent} onChange={e => set('taxRatePercent', e.target.value)} />
          </label>
        </div>
      )}
      {item ? (
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
          <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
          Active (untick to retire the product)
        </label>
      ) : (
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
          <input type="checkbox" checked={form.isAvailable} onChange={e => set('isAvailable', e.target.checked)} />
          Available for sale
        </label>
      )}
      {item && <p className="text-[11px] text-gray-500">Price and availability are changed from the table (Price / toggle).</p>}
      <Actions onClose={savedWithWarning ? onSaved : onClose} saving={saving} label={item ? 'Save changes' : 'Create'} />
    </ModalShell>
  )
}

// ---- Price change ----
const PriceModal: React.FC<{ item: MenuItem; onClose: () => void; onSaved: () => void }> = ({ item, onClose, onSaved }) => {
  const [price, setPrice] = useState(String(item.price))
  const [tax, setTax] = useState(String(item.taxRatePercent))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (price === '' || Number(price) < 0) { setError('Enter a valid price'); return }
    setSaving(true)
    setError('')
    try {
      await adminApiService.updateMenuItemPrice(item.id, { price: Number(price), taxRatePercent: Number(tax) || 0, reason: reason.trim() })
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Failed to change price'))
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`Change price · ${item.name}`} onClose={onClose} onSubmit={submit}>
      <ErrorBox message={error} />
      <p className="text-[11px] text-gray-500">Applies to new sales only. Recorded sales keep their price; the change is kept in the price history.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-gray-700">
          Price
          <input type="number" min="0" step="0.01" className={inputCls} value={price} onChange={e => setPrice(e.target.value)} />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Tax rate %
          <input type="number" min="0" step="0.01" className={inputCls} value={tax} onChange={e => setTax(e.target.value)} />
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-700">
        Reason
        <input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Supplier price increase" />
      </label>
      <Actions onClose={onClose} saving={saving} label="Update price" />
    </ModalShell>
  )
}

// ---- Price history ----
const HistoryModal: React.FC<{ item: MenuItem; onClose: () => void }> = ({ item, onClose }) => {
  const { data, loading, error } = useCachedQuery<PriceHistoryEntry[]>(`menu:price-history:${item.id}`, () => adminApiService.getMenuItemPriceHistory(item.id))
  // changedBy is a staff id; resolve it to a name (falls back to a short id if staff can't be loaded)
  const { data: staff } = useCachedQuery(STAFF_KEY, () => adminApiService.getRestaurantStaff())
  const staffName = (id?: string | null) => {
    if (!id) return '—'
    return staff?.find(m => m.id === id)?.fullName ?? `Staff ${id.slice(0, 8)}`
  }
  const fmt = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  // Newest first; each entry is compared with the one before it in time
  const entries = [...(data ?? [])].sort((a, b) => new Date(b.effectiveFromUtc).getTime() - new Date(a.effectiveFromUtc).getTime())
  const prices = entries.map(e => e.price)
  const stats = [
    { label: 'Current price', value: money(item.price), tone: 'text-blue-700 bg-blue-50' },
    { label: 'Price changes', value: String(Math.max(entries.length - 1, 0)), tone: 'text-gray-800 bg-gray-50' },
    { label: 'Lowest', value: prices.length ? money(Math.min(...prices)) : '—', tone: 'text-green-700 bg-green-50' },
    { label: 'Highest', value: prices.length ? money(Math.max(...prices)) : '—', tone: 'text-amber-700 bg-amber-50' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover bg-gray-100" />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center"><History className="h-6 w-6 text-gray-400" /></div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">Price history</h2>
            <p className="text-xs text-gray-500 truncate">{item.name} · <span className="font-mono">{item.itemCode}</span> · {item.categoryName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close"><XCircle className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <ErrorBox message={error} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {stats.map(s => (
              <div key={s.label} className={`rounded-xl px-4 py-3 ${s.tone}`}>
                <div className="text-[11px] font-medium opacity-70">{s.label}</div>
                <div className="text-lg font-bold mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="py-10 text-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : entries.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No price changes recorded.</div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Price</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Tax</th>
                    <th className="px-4 py-2.5 font-semibold">Change</th>
                    <th className="px-4 py-2.5 font-semibold">Effective from</th>
                    <th className="px-4 py-2.5 font-semibold">Effective to</th>
                    <th className="px-4 py-2.5 font-semibold">Changed by</th>
                    <th className="px-4 py-2.5 font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {entries.map((h, idx) => {
                    const previous = entries[idx + 1]
                    const delta = previous ? h.price - previous.price : null
                    const pct = previous && previous.price ? (delta! / previous.price) * 100 : null
                    const current = !h.effectiveToUtc
                    return (
                      <tr key={idx} className={current ? 'bg-blue-50/50' : 'hover:bg-gray-50'}>
                        <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                          {money(h.price)}
                          {current && <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">Current</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{h.taxRatePercent}%</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {delta === null ? (
                            <span className="text-gray-500">Initial price</span>
                          ) : delta === 0 ? (
                            <span className="text-gray-500">Tax only</span>
                          ) : (
                            <span className={`font-bold ${delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {delta > 0 ? '▲' : '▼'} {money(Math.abs(delta))}{pct !== null ? ` (${Math.abs(pct).toFixed(1)}%)` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmt(h.effectiveFromUtc)}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{current ? 'Now' : fmt(h.effectiveToUtc)}</td>
                        <td className="px-4 py-3 text-gray-700">{staffName(h.changedBy)}</td>
                        <td className="px-4 py-3 text-gray-600">{h.reason || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-white">Close</button>
        </div>
      </div>
    </div>
  )
}

// ---- Page ----
type ModalState = { kind: 'edit'; item: MenuItem | null } | { kind: 'price'; item: MenuItem } | { kind: 'history'; item: MenuItem } | null

const MenuItems: React.FC = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [availability, setAvailability] = useState<'' | 'true' | 'false'>('')
  const [includeRetired, setIncludeRetired] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modal, setModal] = useState<ModalState>(null)
  const [actionError, setActionError] = useState('')
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreview(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  // Debounce typing so each keystroke doesn't hit the API
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const query: MenuItemListQuery = { search: debounced, categoryId, isAvailable: availability, includeRetired, page, pageSize }
  const { data, loading, refreshing, error, refetch, mutate } = useCachedQuery(menuItemsKey(query), () => adminApiService.getMenuItems(query))
  const { data: categories } = useCachedQuery(MENU_CATEGORIES_KEY, () => adminApiService.getMenuCategories())

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))

  const toggleAvailability = async (item: MenuItem) => {
    setActionError('')
    const next = !item.isAvailable
    mutate(d => ({ ...d!, items: (d?.items ?? []).map(i => (i.id === item.id ? { ...i, isAvailable: next } : i)) }))
    try {
      await adminApiService.setMenuItemAvailability(item.id, next)
    } catch (err) {
      setActionError(errMsg(err, 'Failed to change availability'))
      refetch()
    }
  }

  const saved = () => { setModal(null); refetch() }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/restaurant/menu')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Products</h1>
        <span className="text-xs text-gray-500">{total} total</span>
        <div className="flex-1" />
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => setModal({ kind: 'edit', item: null })}
          disabled={!categories || categories.length === 0}
          title={!categories || categories.length === 0 ? 'Create a category first' : undefined}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          New product
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-56">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
          <input className="w-full border border-gray-300 rounded-lg pl-7 pr-2 py-1.5 text-xs" placeholder="Search name or code" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" value={categoryId} onChange={e => { setCategoryId(e.target.value); setPage(1) }}>
          <option value="">All categories</option>
          {(categories ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs" value={availability} onChange={e => { setAvailability(e.target.value as '' | 'true' | 'false'); setPage(1) }}>
          <option value="">Any availability</option>
          <option value="true">Available</option>
          <option value="false">Unavailable</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <input type="checkbox" checked={includeRetired} onChange={e => { setIncludeRetired(e.target.checked); setPage(1) }} />
          Include retired
        </label>
      </div>

      {(error || actionError) && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error || actionError}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Product</th>
              <th className="px-3 py-2 font-semibold">Code</th>
              <th className="px-3 py-2 font-semibold">Category</th>
              <th className="px-3 py-2 font-semibold text-right">Price</th>
              <th className="px-3 py-2 font-semibold text-right">Tax</th>
              <th className="px-3 py-2 font-semibold">Available</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">No products found.</td></tr>
            ) : (
              items.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {i.imageUrl ? (
                        <img
                          src={i.imageUrl}
                          alt={i.name}
                          loading="lazy"
                          onClick={() => setPreview({ url: i.imageUrl!, name: i.name })}
                          className="h-16 w-16 rounded-lg object-cover bg-gray-100 cursor-zoom-in hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-gray-100" />
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{i.name}</div>
                        {i.description && <div className="text-[10px] text-gray-500 truncate max-w-[220px]">{i.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-700">{i.itemCode}</td>
                  <td className="px-3 py-2 text-gray-600">{i.categoryName}</td>
                  <td className="px-3 py-2 text-right font-medium">{money(i.price)}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{i.taxRatePercent}%</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleAvailability(i)}
                      disabled={!i.isActive}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold disabled:opacity-40 ${i.isAvailable ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                      title="Toggle availability"
                    >
                      {i.isAvailable ? 'Available' : 'Unavailable'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${i.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {i.isActive ? 'Active' : 'Retired'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setModal({ kind: 'price', item: i })} className="p-1 rounded hover:bg-gray-100" title="Change price"><Tag className="h-3.5 w-3.5 text-gray-600" /></button>
                    <button onClick={() => setModal({ kind: 'history', item: i })} className="p-1 rounded hover:bg-gray-100" title="Price history"><History className="h-3.5 w-3.5 text-gray-600" /></button>
                    <button onClick={() => setModal({ kind: 'edit', item: i })} className="p-1 rounded hover:bg-gray-100" title="Edit"><Edit className="h-3.5 w-3.5 text-gray-600" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
        <Pagination
          currentPage={page}
          totalPages={pages}
          totalItems={total}
          itemsPerPage={pageSize}
          onPageChange={setPage}
          onItemsPerPageChange={n => { setPageSize(n); setPage(1) }}
        />
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 cursor-zoom-out"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow text-gray-700 hover:bg-gray-100"
              aria-label="Close"
            >
              <XCircle className="h-5 w-5" />
            </button>
            <img src={preview.url} alt={preview.name} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain bg-white" />
            <p className="mt-2 text-center text-sm font-medium text-white">{preview.name}</p>
          </div>
        </div>
      )}

      {modal?.kind === 'edit' && <ItemModal item={modal.item} categories={categories ?? []} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'price' && <PriceModal item={modal.item} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'history' && <HistoryModal item={modal.item} onClose={() => setModal(null)} />}
    </div>
  )
}

export default MenuItems
