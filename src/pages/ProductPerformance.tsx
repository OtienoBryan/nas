import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { adminApiService } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { reportKey, STAFF_KEY } from '../services/queryKeys'
import { DATE_PRESETS, rangeError } from '../utils/dateRange'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'

type Metric = 'value' | 'qty'

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const selectCls = 'border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white'
const BAR = '#272975' // one hue: bar height carries the magnitude
const PAD_L = 48, PAD_T = 22, PLOT_H = 240, COL_W = 64, BAR_W = 36, H = PAD_T + PLOT_H + 90

const ProductPerformance: React.FC = () => {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [dFrom, dTo] = DATE_PRESETS[3].range() // this month
  const from = sp.get('from') ?? dFrom
  const to = sp.get('to') ?? dTo
  const staffId = sp.get('staffId') ?? ''
  const [metric, setMetric] = useState<Metric>('value')
  const [topN, setTopN] = useState(10)
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [active, setActive] = useState<string | null>(null)

  // Keep the filters in the URL so the page can be shared and the back button restores them
  const setParams = (next: Record<string, string>) => {
    const q = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(next)) (v ? q.set(k, v) : q.delete(k))
    setSp(q, { replace: true })
  }

  const error = rangeError(from, to)
  const staff = useCachedQuery(STAFF_KEY, () => adminApiService.getRestaurantStaff())
  const { data, loading, refreshing, error: loadError, refetch } = useCachedQuery(
    reportKey('product-performance-page', { from, to, staffId }),
    () => (error ? Promise.resolve([]) : adminApiService.getReportBreakdown({ from, to, staffId, groupBy: 'Item' }))
  )

  const val = (r: { netSales: number; quantity: number }) => (metric === 'value' ? r.netSales : r.quantity)
  const { ranked, shown, totalValue, totalQty, max } = useMemo(() => {
    const all = [...(error ? [] : data ?? [])].filter(r => r.netSales > 0 || r.quantity > 0)
    all.sort((a, b) => val(b) - val(a) || b.netSales - a.netSales)
    const shown = topN === 0 ? all : all.slice(0, topN)
    return {
      ranked: all,
      shown,
      totalValue: all.reduce((a, r) => a + r.netSales, 0),
      totalQty: all.reduce((a, r) => a + r.quantity, 0),
      max: shown.length ? val(shown[0]) : 0,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, metric, topN, error])

  // Round the y axis up to a tidy maximum with 4 even steps
  const yMax = useMemo(() => {
    if (!max) return 1
    const pow = 10 ** Math.floor(Math.log10(max))
    const step = [1, 2, 2.5, 5, 10].map(s => s * pow).find(s => s * 4 >= max) ?? 10 * pow
    return step * 4
  }, [max])
  const ticks = [0, 1, 2, 3, 4].map(i => (yMax / 4) * i)
  const tickFmt = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(+n.toFixed(2)))
  const total = metric === 'value' ? totalValue : totalQty
  const fmt = (n: number) => (metric === 'value' ? money(n) : String(n))
  const share = (n: number) => (total ? ((n / total) * 100).toFixed(1) : '0.0')

  const tiles = [
    ['Products sold', String(ranked.length)],
    ['Units sold', String(totalQty)],
    ['Net sales', money(totalValue)],
    ['Top product', ranked[0] ? ranked[0].label : '—'],
  ]
  const back = () => navigate(`/restaurant/reports/products?${new URLSearchParams({ from, to })}`)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={back} className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Back">
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Products performance</h1>
          <p className="text-[11px] text-gray-500">{from} to {to} · ranked by {metric === 'value' ? 'value sold' : 'quantity sold'}</p>
        </div>
        <div className="flex-1" />
        <button onClick={() => refetch()} disabled={refreshing} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50" title="Refresh">
          <RefreshCw className={`h-4 w-4 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-medium">
          {(['chart', 'table'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 capitalize ${view === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* Filters: one row above the chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map(p => {
            const [f, t] = p.range()
            const on = f === from && t === to
            return (
              <button
                key={p.label}
                onClick={() => setParams({ from: f, to: t })}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-600">From
          <input type="date" max={to || undefined} value={from} onChange={e => setParams({ from: e.target.value, to })} className={selectCls} />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">To
          <input type="date" min={from || undefined} value={to} onChange={e => setParams({ from, to: e.target.value })} className={selectCls} />
        </label>
        <select value={staffId} onChange={e => setParams({ staffId: e.target.value })} className={selectCls} aria-label="Staff">
          <option value="">All waiters</option>
          {(staff.data ?? []).filter(m => m.role === 'Waiter').sort((a, b) => a.fullName.localeCompare(b.fullName)).map(m => (
            <option key={m.id} value={m.id}>{m.fullName} (#{m.staffNumber})</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-600">Rank by
          <select value={metric} onChange={e => setMetric(e.target.value as Metric)} className={selectCls}>
            <option value="value">Value sold</option>
            <option value="qty">Quantity sold</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">Show
          <select value={topN} onChange={e => setTopN(Number(e.target.value))} className={selectCls}>
            {[5, 10, 20].map(n => <option key={n} value={n}>Top {n}</option>)}
            <option value={0}>All</option>
          </select>
        </label>
      </div>

      {error && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-4 py-2">{error}</div>}
      {loadError && !error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-2">{loadError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white border border-gray-100 shadow-sm px-4 py-3 min-w-0">
            <div className="text-[11px] font-medium text-gray-500">{k}</div>
            <div className="text-base font-bold text-gray-900 mt-0.5 truncate" title={v}>{v}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : shown.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-gray-400">No product sales in this period.</div>
        ) : view === 'chart' ? (
          <div onPointerLeave={() => setActive(null)}>
            <div className="overflow-x-auto">
              <svg
                width={Math.max(PAD_L + shown.length * COL_W + 8, 480)}
                height={H}
                role="img"
                aria-label={`Bar graph of products by ${metric === 'value' ? 'value' : 'quantity'} sold`}
                className="block"
              >
                {/* Recessive grid + y axis */}
                {ticks.map(t => {
                  const y = PAD_T + PLOT_H - (t / yMax) * PLOT_H
                  return (
                    <g key={t}>
                      <line x1={PAD_L} x2="100%" y1={y} y2={y} stroke="#e5e4e0" strokeWidth={1} />
                      <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#8a8984">{tickFmt(t)}</text>
                    </g>
                  )
                })}
                {shown.map((r, i) => {
                  const v = val(r)
                  const h = yMax ? Math.max((v / yMax) * PLOT_H, v > 0 ? 2 : 0) : 0
                  const x = PAD_L + i * COL_W + (COL_W - BAR_W) / 2
                  const y = PAD_T + PLOT_H - h
                  const on = active === r.key
                  const cx = x + BAR_W / 2
                  return (
                    <g key={r.key} onPointerEnter={() => setActive(r.key)} style={{ cursor: 'default' }}>
                      <title>{`${r.label} (${r.key}) · ${r.quantity} sold · ${money(r.netSales)} · ${r.transactionCount} sale${r.transactionCount === 1 ? '' : 's'} · ${share(v)}%`}</title>
                      {/* Hit target wider than the mark */}
                      <rect x={PAD_L + i * COL_W} y={PAD_T} width={COL_W} height={PLOT_H + 40} fill={on ? '#f4f3ef' : 'transparent'} />
                      {/* 4px rounded data end, anchored to the baseline */}
                      <path
                        d={`M${x},${PAD_T + PLOT_H} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + BAR_W - 4} Q${x + BAR_W},${y} ${x + BAR_W},${y + 4} V${PAD_T + PLOT_H} Z`}
                        fill={BAR}
                        opacity={active === null || on ? 1 : 0.45}
                      />
                      <text x={cx} y={y - 5} textAnchor="middle" fontSize={10} fontWeight={on ? 700 : 500} fill="#0b0b0b">{tickFmt(v)}</text>
                      <text
                        transform={`translate(${cx},${PAD_T + PLOT_H + 12}) rotate(-35)`}
                        textAnchor="end"
                        fontSize={10}
                        fill="#52514e"
                      >
                        {r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label}
                      </text>
                    </g>
                  )
                })}
                <line x1={PAD_L} x2="100%" y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H} stroke="#b8b7b2" strokeWidth={1} />
              </svg>
            </div>
            <p className="mt-2 text-[10px] text-gray-400">
              Showing {shown.length} of {ranked.length} product{ranked.length === 1 ? '' : 's'} · total {fmt(total)}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th><th className="px-3 py-2 font-semibold">Product</th><th className="px-3 py-2 font-semibold">Code</th>
                  <th className="px-3 py-2 font-semibold text-right">Qty sold</th><th className="px-3 py-2 font-semibold text-right">Sales</th>
                  <th className="px-3 py-2 font-semibold text-right">Value</th><th className="px-3 py-2 font-semibold text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((r, i) => (
                  <tr key={r.key}>
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium text-gray-900">{r.label}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-600">{r.key}</td>
                    <td className="px-3 py-1.5 text-right">{r.quantity}</td>
                    <td className="px-3 py-1.5 text-right">{r.transactionCount}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{money(r.netSales)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{share(val(r))}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProductPerformance
