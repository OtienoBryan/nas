import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApiService, MenuCategory, MenuCategoryInput } from '../services/api'
import Pagination from '../components/ui/Pagination'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { MENU_CATEGORIES_KEY } from '../services/queryKeys'
import { ArrowLeft, Plus, Search, Edit, RefreshCw, XCircle, Loader2 } from 'lucide-react'

const EMPTY: MenuCategoryInput = { code: '', name: '', sortOrder: 0, isActive: true }

// Next free numeric code: one above the highest existing number, zero-padded (001, 002, ...)
function nextCategoryCode(existing: string[]): string {
  const taken = new Set(existing.map(c => c.trim().toUpperCase()))
  const numbers = existing.map(c => (/^\d+$/.test(c.trim()) ? Number(c.trim()) : 0))
  let n = Math.max(0, ...numbers) + 1
  const width = Math.max(3, ...existing.filter(c => /^\d+$/.test(c.trim())).map(c => c.trim().length))
  while (taken.has(String(n).padStart(width, '0'))) n++
  return String(n).padStart(width, '0')
}

interface ModalProps {
  category: MenuCategory | null // null = creating
  existingCodes: string[]
  onClose: () => void
  onSaved: (saved: MenuCategoryInput) => void
}

const CategoryModal: React.FC<ModalProps> = ({ category, existingCodes, onClose, onSaved }) => {
  const [form, setForm] = useState<MenuCategoryInput>(
    category
      ? { code: category.code, name: category.name, sortOrder: category.sortOrder, isActive: category.isActive }
      : { ...EMPTY, code: nextCategoryCode(existingCodes) }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      setError('Code and name are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, code: form.code.trim(), name: form.name.trim(), sortOrder: Number(form.sortOrder) || 0 }
      if (category) await adminApiService.updateMenuCategory(category.id, payload)
      else await adminApiService.createMenuCategory(payload)
      onSaved(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">{category ? 'Edit category' : 'New category'}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-2 py-1.5">{error}</div>}

        <label className="block text-xs font-medium text-gray-700">
          Code
          <input
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono"
            value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
          />
          {!category && <span className="block mt-1 text-[11px] font-normal text-gray-500">Generated automatically. You can change it.</span>}
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Name
          <input
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Drinks"
          />
        </label>
        <label className="block text-xs font-medium text-gray-700">
          Sort order
          <input
            type="number"
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
            value={form.sortOrder}
            onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
          Active
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {category ? 'Save changes' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

const MenuCategories: React.FC = () => {
  const navigate = useNavigate()
  const { data, loading, refreshing, error, refetch: load, mutate } = useCachedQuery(MENU_CATEGORIES_KEY, () => adminApiService.getMenuCategories())
  const categories = data ?? []
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modal, setModal] = useState<{ category: MenuCategory | null } | null>(null)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...categories]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
  }, [categories, search])

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/restaurant/menu')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Menu categories</h1>
        <div className="flex-1" />
        <button onClick={load} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={() => setModal({ category: null })}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus className="h-3.5 w-3.5" />
          New category
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
        <input
          className="w-full border border-gray-300 rounded-lg pl-7 pr-2 py-1.5 text-xs"
          placeholder="Search by name or code"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Code</th>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Sort</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400"><Loader2 className="h-4 w-4 animate-spin inline" /></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No categories found.</td></tr>
            ) : (
              pageRows.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-700">{c.code}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{c.name}</td>
                  <td className="px-3 py-2 text-gray-600">{c.sortOrder}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setModal({ category: c })} className="p-1 rounded hover:bg-gray-100" title="Edit">
                      <Edit className="h-3.5 w-3.5 text-gray-600" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={visible.length}
          itemsPerPage={pageSize}
          onPageChange={setPage}
          onItemsPerPageChange={n => { setPageSize(n); setPage(1) }}
        />
      </div>

      {modal && (
        <CategoryModal
          category={modal.category}
          existingCodes={categories.map(c => c.code)}
          onClose={() => setModal(null)}
          onSaved={saved => {
            // Show the edit straight away, then reconcile with the server in the background
            if (modal.category) {
              const id = modal.category.id
              mutate(list => (list ?? []).map(c => (c.id === id ? { ...c, ...saved } : c)))
            }
            setModal(null)
            load()
          }}
        />
      )}
    </div>
  )
}

export default MenuCategories
