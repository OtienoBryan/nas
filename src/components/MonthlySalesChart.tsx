import { useEffect, useMemo, useRef, useState } from 'react'
import { BreakdownRow } from '../services/api'

export interface MonthPoint {
  month: string // YYYY-MM
  netSales: number
  transactionCount: number
  quantity: number
}

// Buckets daily breakdown rows (key = YYYY-MM-DD) into calendar months, filling any month
// in range that had no sales with zero so the axis is a continuous run of months.
export function aggregateMonths(rows: BreakdownRow[], from: string, to: string): MonthPoint[] {
  const byMonth = new Map<string, MonthPoint>()
  for (const r of rows) {
    const month = r.key.slice(0, 7)
    const cur = byMonth.get(month) ?? { month, netSales: 0, transactionCount: 0, quantity: 0 }
    cur.netSales += r.netSales
    cur.transactionCount += r.transactionCount
    cur.quantity += r.quantity
    byMonth.set(month, cur)
  }
  const out: MonthPoint[] = []
  const d = new Date(`${from}T00:00:00`)
  d.setDate(1)
  const end = new Date(`${to}T00:00:00`)
  while (d <= end) {
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push(byMonth.get(month) ?? { month, netSales: 0, transactionCount: 0, quantity: 0 })
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

const COLOR = '#2a78d6'
const INK = '#52514e'
const MUTED = '#8a8984'
const GRID = '#ececea'
const SURFACE = '#ffffff'

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compact = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(1)}K` : String(n))
const monthShort = (iso: string) => new Date(`${iso}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' })
const monthLabel = (iso: string) => new Date(`${iso}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

function niceScale(max: number, tickCount = 4): { max: number; ticks: number[] } {
  if (max <= 0) return { max: 1, ticks: [0, 1] }
  const rough = max / tickCount
  const pow = Math.pow(10, Math.floor(Math.log10(rough)))
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= rough) ?? 10 * pow
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 1e6; v += step) ticks.push(+v.toFixed(6))
  return { max: top, ticks }
}

const HEIGHT = 260
const PAD = { top: 12, right: 12, bottom: 28, left: 46 }

const MonthlySalesChart: React.FC<{ data: MonthPoint[]; currency?: string }> = ({ data, currency }) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setWidth(Math.max(280, entries[0].contentRect.width)))
    ro.observe(el)
    setWidth(Math.max(280, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const { max, ticks } = useMemo(() => niceScale(Math.max(0, ...data.map(d => d.netSales))), [data])

  const slot = data.length ? plotW / data.length : plotW
  const barW = Math.min(40, Math.max(4, slot - 10))
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH
  const x = (i: number) => PAD.left + slot * i + slot / 2

  const every = Math.max(1, Math.ceil(data.length / 12))
  const peak = data.reduce((best, d, i) => (d.netSales > (data[best]?.netSales ?? -1) ? i : best), 0)
  const active = hover !== null ? data[hover] : null

  const barPath = (cx: number, h: number) => {
    const r = Math.min(4, barW / 2, h)
    const l = cx - barW / 2
    const rgt = cx + barW / 2
    const top = y(0) - h
    return `M${l},${y(0)} V${top + r} Q${l},${top} ${l + r},${top} H${rgt - r} Q${rgt},${top} ${rgt},${top + r} V${y(0)} Z`
  }

  const tipLeft = hover !== null ? Math.min(Math.max(x(hover), 90), width - 90) : 0

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      <svg width={width} height={HEIGHT} role="img" aria-label="Monthly net sales" onPointerLeave={() => setHover(null)}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={MUTED}>{compact(t)}</text>
          </g>
        ))}

        {data.map((d, i) => {
          const h = (d.netSales / max) * plotH
          if (h <= 0) return null
          return <path key={d.month} d={barPath(x(i), h)} fill={COLOR} opacity={hover === null || hover === i ? 1 : 0.45} />
        })}

        {data.map((d, i) =>
          i % every === 0 ? (
            <text key={d.month} x={x(i)} y={HEIGHT - 10} textAnchor="middle" fontSize={10} fill={MUTED}>{monthShort(d.month)}</text>
          ) : null
        )}

        {data[peak]?.netSales > 0 && (
          <text x={Math.min(Math.max(x(peak), PAD.left + 20), width - PAD.right - 20)} y={y(data[peak].netSales) - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill={INK}>
            {compact(data[peak].netSales)}
          </text>
        )}

        {data.map((d, i) => (
          <rect
            key={d.month}
            x={PAD.left + slot * i}
            y={PAD.top}
            width={slot}
            height={plotH + PAD.bottom}
            fill="transparent"
            tabIndex={0}
            role="img"
            aria-label={`${monthLabel(d.month)}: ${money(d.netSales)} from ${d.transactionCount} sales`}
            onPointerEnter={() => setHover(i)}
            onPointerMove={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            style={{ outline: 'none' }}
          />
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={y(0)} y2={y(0) + 4} stroke={COLOR} strokeWidth={2} />}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"
          style={{ left: tipLeft, top: Math.max(0, y(active.netSales) - 74), background: SURFACE }}
        >
          <div className="text-[10px] text-gray-500 whitespace-nowrap">{monthLabel(active.month)}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: COLOR }} />
            <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{currency ? `${currency} ` : ''}{money(active.netSales)}</span>
          </div>
          <div className="text-[10px] text-gray-500 whitespace-nowrap">{active.transactionCount} sale{active.transactionCount === 1 ? '' : 's'} · {active.quantity} items</div>
        </div>
      )}
    </div>
  )
}

export default MonthlySalesChart
