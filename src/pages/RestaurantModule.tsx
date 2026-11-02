import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Play, Loader2 } from 'lucide-react'
import { RESTAURANT_MODULES, ModuleEndpoint } from '../services/restaurantModules'

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
}

interface RunResult {
  status: number
  body: string
}

const RestaurantModule: React.FC = () => {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [results, setResults] = useState<Record<string, RunResult | 'loading'>>({})
  const module = RESTAURANT_MODULES.find(m => m.slug === slug)

  if (!module) {
    return <div className="p-6 text-sm text-gray-500">Unknown module.</div>
  }

  // Only parameterless GETs can be run without input
  const runnable = (e: ModuleEndpoint) => e.method === 'GET' && !e.path.includes(':')

  const run = async (e: ModuleEndpoint) => {
    const key = `${e.method} ${e.path}`
    setResults(r => ({ ...r, [key]: 'loading' }))
    try {
      const token = localStorage.getItem('adminToken')
      const res = await fetch(e.path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const text = await res.text()
      let body = text
      try { body = JSON.stringify(JSON.parse(text), null, 2) } catch { /* not JSON */ }
      setResults(r => ({ ...r, [key]: { status: res.status, body } }))
    } catch (err) {
      setResults(r => ({ ...r, [key]: { status: 0, body: err instanceof Error ? err.message : 'Request failed' } }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">{module.name}</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        {module.endpoints.map(e => {
          const key = `${e.method} ${e.path}`
          const result = results[key]
          return (
            <div key={key} className="p-3">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${METHOD_STYLES[e.method]}`}>{e.method}</span>
                <code className="text-xs text-gray-700 flex-1 break-all">{e.path}</code>
                {e.page && (
                  <button
                    onClick={() => navigate(e.page!)}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
                  >
                    Open page
                  </button>
                )}
                {runnable(e) && (
                  <button
                    onClick={() => run(e)}
                    disabled={result === 'loading'}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    {result === 'loading' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Run
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{e.description}</p>
              {result && result !== 'loading' && (
                <pre className="mt-2 max-h-64 overflow-auto bg-gray-50 border border-gray-200 rounded-lg p-2 text-[11px] text-gray-800">
                  {`HTTP ${result.status}\n${result.body}`}
                </pre>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RestaurantModule
