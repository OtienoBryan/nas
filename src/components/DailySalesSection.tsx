import { useMemo, useState } from 'react'
import { adminApiService } from '../services/api'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { reportKey } from '../services/queryKeys'
import { DATE_PRESETS, daysAgo, rangeError, ymd } from '../utils/dateRange'
import DailySalesChart, { fillDays } from './DailySalesChart'
import { Loader2, RefreshCw } from 'lucide-react'

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })

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

const inputCls = 'border border-gray-300 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white'

const DailySalesSection: React.FC = () => {
  const [[from, to], setRange] = useState<[string, string]>(PRESETS[0].range())
  const [view, setView] = useState<'chart' | 'table'>('chart')

  const error = rangeError(from, to)
  const { data, loading, refreshing, error: loadError, refetch } = useCachedQuery(
    reportKey('daily-sales', { from, to }),
    () => (error ? Promise.resolve([]) : adminApiService.getReportBreakdown({ from, to, groupBy: 'Day' }))
  )

  const days = useMemo(() => (error ? [] : fillDays(data ?? [], from, to)), [data, from, to, error])
  const total = days.reduce((a, d) => a + d.netSales, 0)
  const sales = days.reduce((a, d) => a + d.transactionCount, 0)
  const best = days.reduce((b, d) => (d.netSales > b.netSales ? d : b), { date: '', netSales: 0, transactionCount: 0, quantity: 0 })
  const stats = [
    ['Net sales', money(total)],
    ['Sales', String(sales)],
    ['Average per day', days.length ? money(total / days.length) : '—'],
    ['Best day', best.netSales > 0 ? `${shortDay(best.date)} · ${money(best.netSales)}` : '—'],
  ]

  return (
    <section className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-100">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Daily sales</h2>
          <p className="text-[11px] text-gray-500">Net sales per day</p>
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
      </div>

      {error && <div className="mx-5 mb-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2">{error}</div>}
      {loadError && !error && <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{loadError}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 pb-3">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-gray-50 px-3 py-2">
            <div className="text-[10px] font-medium text-gray-500">{k}</div>
            <div className="text-sm font-bold text-gray-900 mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-5">
        {loading ? (
          <div className="h-[260px] flex items-center justify-center text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : view === 'chart' ? (
          days.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-xs text-gray-400">No data for this period.</div>
          ) : total === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-xs text-gray-400">No sales in this period.</div>
          ) : (
            <DailySalesChart data={days} />
          )
        ) : (
          <div className="max-h-[260px] overflow-y-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 text-left sticky top-0">
                <tr><th className="px-3 py-2 font-semibold">Date</th><th className="px-3 py-2 font-semibold text-right">Sales</th><th className="px-3 py-2 font-semibold text-right">Items</th><th className="px-3 py-2 font-semibold text-right">Net sales</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {days.map(d => (
                  <tr key={d.date}>
                    <td className="px-3 py-1.5">{new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-3 py-1.5 text-right">{d.transactionCount}</td>
                    <td className="px-3 py-1.5 text-right">{d.quantity}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{money(d.netSales)}</td>
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

export default DailySalesSection
