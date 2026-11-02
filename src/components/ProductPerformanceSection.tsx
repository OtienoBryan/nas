import { useMemo, useState } from 'react'
import { adminApiService } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { reportKey } from '../services/queryKeys'
import { DATE_PRESETS, daysAgo, rangeError, ymd } from '../utils/dateRange'
import { Loader2, RefreshCw } from 'lucide-react'

// Categorical slots 1-7 in fixed order (never cycled); "Other" is a neutral gray, not a hue
const SLICE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6']
const OTHER_COLOR = '#b8b7b2'

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PRESETS: Array<{ label: string; range: () => [string, string] }> = [
  DATE_PRESETS[3], // This month (1st to today)
  {
    label: 'Last month',
    range: () => {
      const d = new Date()
      return [ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), ymd(new Date(d.getFullYear(), d.getMonth(), 0))]
    },
  },
  DATE_PRESETS[1], // Last 7 days
  { label: 'Last 30 days', range: () => [daysAgo(29), daysAgo(0)] },
]

type Metric = 'value' | 'qty'
const inputCls = 'border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white'

interface Slice {
  key: string
  label: string
  value: number // the metric being sliced
  netSales: number
  quantity: number
  transactionCount: number
  color: string
  isOther?: boolean
  count?: number // products folded into "Other"
}

// ---- Donut ----
const SIZE = 220
const R_OUT = 100
const R_IN = 64
const GAP_PX = 2 // surface gap between touching segments

const polar = (r: number, a: number) => [SIZE / 2 + r * Math.cos(a), SIZE / 2 + r * Math.sin(a)]

function sectorPath(a0: number, a1: number) {
  // Leave a 2px gap (measured at the mid radius) between neighbours
  const gap = GAP_PX / ((R_OUT + R_IN) / 2)
  const s = a0 + gap / 2
  const e = a1 - gap / 2
  if (e <= s) return ''
  const large = e - s > Math.PI ? 1 : 0
  const [x0, y0] = polar(R_OUT, s)
  const [x1, y1] = polar(R_OUT, e)
  const [x2, y2] = polar(R_IN, e)
  const [x3, y3] = polar(R_IN, s)
  return `M${x0},${y0} A${R_OUT},${R_OUT} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${R_IN},${R_IN} 0 ${large} 0 ${x3},${y3} Z`
}

const Donut: React.FC<{
  slices: Slice[]
  total: number
  metric: Metric
  active: number | null
  onActive: (i: number | null) => void
}> = ({ slices, total, metric, active, onActive }) => {
  let angle = -Math.PI / 2
  const arcs = slices.map(s => {
    const sweep = total ? (s.value / total) * Math.PI * 2 : 0
    const a0 = angle
    angle += sweep
    return { a0, a1: angle, sweep }
  })
  const act = active !== null ? slices[active] : null
  const fmt = (n: number) => (metric === 'value' ? money(n) : String(n))

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Share of sales by product" onPointerLeave={() => onActive(null)}>
      {slices.length === 1 ? (
        // A single slice is a full ring
        <path
          d={`M${SIZE / 2 - R_OUT},${SIZE / 2} a${R_OUT},${R_OUT} 0 1 0 ${R_OUT * 2},0 a${R_OUT},${R_OUT} 0 1 0 ${-R_OUT * 2},0 M${SIZE / 2 - R_IN},${SIZE / 2} a${R_IN},${R_IN} 0 1 1 ${R_IN * 2},0 a${R_IN},${R_IN} 0 1 1 ${-R_IN * 2},0`}
          fill={slices[0].color}
          fillRule="evenodd"
          onPointerEnter={() => onActive(0)}
        />
      ) : (
        slices.map((s, i) => (
          <path
            key={s.key}
            d={sectorPath(arcs[i].a0, arcs[i].a1)}
            fill={s.color}
            opacity={active === null || active === i ? 1 : 0.4}
            style={{ transition: 'opacity 120ms', cursor: 'pointer' }}
            tabIndex={0}
            role="img"
            aria-label={`${s.label}: ${fmt(s.value)}, ${total ? ((s.value / total) * 100).toFixed(1) : 0}%`}
            onPointerEnter={() => onActive(i)}
            onFocus={() => onActive(i)}
            onBlur={() => onActive(null)}
          />
        ))
      )}

      {/* Centre: the total, or the hovered slice (text uses text tokens, never the slice colour) */}
      <text x={SIZE / 2} y={SIZE / 2 - 10} textAnchor="middle" fontSize={10} fill="#8a8984">
        {act ? (act.label.length > 16 ? `${act.label.slice(0, 15)}…` : act.label) : metric === 'value' ? 'Net sales' : 'Units sold'}
      </text>
      <text x={SIZE / 2} y={SIZE / 2 + 10} textAnchor="middle" fontSize={act ? 17 : 19} fontWeight={700} fill="#0b0b0b">
        {fmt(act ? act.value : total)}
      </text>
      {act && total > 0 && (
        <text x={SIZE / 2} y={SIZE / 2 + 28} textAnchor="middle" fontSize={11} fill="#52514e">
          {((act.value / total) * 100).toFixed(1)}%
        </text>
      )}
    </svg>
  )
}

// ---- Section ----
const ProductPerformanceSection: React.FC = () => {
  const [[from, to], setRange] = useState<[string, string]>(PRESETS[0].range())
  const [metric, setMetric] = useState<Metric>('value')
  const [topN, setTopN] = useState(5)
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [active, setActive] = useState<number | null>(null)

  const error = rangeError(from, to)
  const { data, loading, refreshing, error: loadError, refetch } = useCachedQuery(
    reportKey('product-performance', { from, to }),
    () => (error ? Promise.resolve([]) : adminApiService.getReportBreakdown({ from, to, groupBy: 'Item' }))
  )

  const { products, slices, total, totalValue, totalQty } = useMemo(() => {
    const all = [...(error ? [] : data ?? [])].filter(r => (metric === 'value' ? r.netSales : r.quantity) > 0)
    const val = (r: { netSales: number; quantity: number }) => (metric === 'value' ? r.netSales : r.quantity)
    all.sort((a, b) => val(b) - val(a) || b.netSales - a.netSales)

    const head = all.slice(0, topN)
    const tail = all.slice(topN)
    const slices: Slice[] = head.map((r, i) => ({
      key: r.key, label: r.label, value: val(r), netSales: r.netSales, quantity: r.quantity,
      transactionCount: r.transactionCount, color: SLICE_COLORS[i],
    }))
    if (tail.length) {
      slices.push({
        key: '__other', label: `Other (${tail.length})`, value: tail.reduce((a, r) => a + val(r), 0),
        netSales: tail.reduce((a, r) => a + r.netSales, 0), quantity: tail.reduce((a, r) => a + r.quantity, 0),
        transactionCount: tail.reduce((a, r) => a + r.transactionCount, 0), color: OTHER_COLOR, isOther: true, count: tail.length,
      })
    }
    return {
      products: all,
      slices,
      total: all.reduce((a, r) => a + val(r), 0),
      totalValue: all.reduce((a, r) => a + r.netSales, 0),
      totalQty: all.reduce((a, r) => a + r.quantity, 0),
    }
  }, [data, metric, topN, error])

  const fmt = (n: number) => (metric === 'value' ? money(n) : String(n))
  const stats = [
    ['Products sold', String(products.length)],
    ['Units sold', String(totalQty)],
    ['Net sales', money(totalValue)],
    ['Top product', products[0] ? products[0].label : '—'],
  ]

  return (
    <section className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Product performance</h2>
          <p className="text-[11px] text-gray-500">Share of {metric === 'value' ? 'sales value' : 'units sold'} by product</p>
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
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map(p => {
            const [f, t] = p.range()
            const on = f === from && t === to
            return (
              <button
                key={p.label}
                onClick={() => setRange([f, t])}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-600">From
          <input type="date" max={to || undefined} value={from} onChange={e => setRange([e.target.value, to])} className={inputCls} />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">To
          <input type="date" min={from || undefined} value={to} onChange={e => setRange([from, e.target.value])} className={inputCls} />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">Slice by
          <select value={metric} onChange={e => setMetric(e.target.value as Metric)} className={inputCls}>
            <option value="value">Value sold</option>
            <option value="qty">Quantity sold</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-600">Show
          <select value={topN} onChange={e => setTopN(Number(e.target.value))} className={inputCls}>
            {[3, 5, 7].map(n => <option key={n} value={n}>Top {n} + other</option>)}
          </select>
        </label>
      </div>

      {error && <div className="mx-5 mb-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2">{error}</div>}
      {loadError && !error && <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{loadError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 pb-3">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-gray-50 px-3 py-2 min-w-0">
            <div className="text-[10px] font-medium text-gray-500">{k}</div>
            <div className="text-sm font-bold text-gray-900 mt-0.5 truncate" title={v}>{v}</div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5">
        {loading ? (
          <div className="h-[220px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : slices.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-gray-400">No product sales in this period.</div>
        ) : view === 'chart' ? (
          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
            <div className="shrink-0">
              <Donut slices={slices} total={total} metric={metric} active={active} onActive={setActive} />
            </div>

            {/* Legend: always present, mirrors the marks, carries the exact figures */}
            <div className="flex-1 w-full min-w-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-500 text-left">
                  <tr><th className="py-1.5 font-semibold" colSpan={2}>Product</th><th className="py-1.5 font-semibold text-right">Qty</th><th className="py-1.5 font-semibold text-right">Value</th><th className="py-1.5 font-semibold text-right">Share</th></tr>
                </thead>
                <tbody>
                  {slices.map((s, i) => (
                    <tr
                      key={s.key}
                      onPointerEnter={() => setActive(i)}
                      onPointerLeave={() => setActive(null)}
                      className={`border-t border-gray-100 ${active === i ? 'bg-gray-50' : ''}`}
                    >
                      <td className="py-2 pr-2 w-4"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} /></td>
                      <td className="py-2 pr-3 text-gray-800 font-medium truncate max-w-[200px]" title={s.label}>{s.label}</td>
                      <td className="py-2 text-right text-gray-600">{s.quantity}</td>
                      <td className="py-2 text-right font-semibold text-gray-900">{money(s.netSales)}</td>
                      <td className="py-2 text-right text-gray-600">{total ? ((s.value / total) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-[10px] text-gray-400">Sliced by {metric === 'value' ? 'value' : 'quantity'} · total {fmt(total)}</p>
            </div>
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th><th className="px-3 py-2 font-semibold">Product</th><th className="px-3 py-2 font-semibold">Code</th>
                  <th className="px-3 py-2 font-semibold text-right">Qty sold</th><th className="px-3 py-2 font-semibold text-right">Sales</th>
                  <th className="px-3 py-2 font-semibold text-right">Value</th><th className="px-3 py-2 font-semibold text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((r, i) => (
                  <tr key={r.key}>
                    <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium text-gray-900">{r.label}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-600">{r.key}</td>
                    <td className="px-3 py-1.5 text-right">{r.quantity}</td>
                    <td className="px-3 py-1.5 text-right">{r.transactionCount}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{money(r.netSales)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{totalValue ? ((r.netSales / totalValue) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default ProductPerformanceSection
