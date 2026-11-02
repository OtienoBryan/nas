// Local calendar-day helpers (YYYY-MM-DD). The reports API treats `To` as exclusive and caps a period at 366 days.
export const MAX_RANGE_DAYS = 366

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return ymd(d)
}

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000)

// Inclusive end day -> the exclusive `To` the API expects
export const nextDay = (day: string) => {
  const d = new Date(`${day}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return ymd(d)
}

export const DATE_PRESETS: Array<{ label: string; range: () => [string, string] }> = [
  { label: 'Today', range: () => [daysAgo(0), daysAgo(0)] },
  { label: 'Last 7 days', range: () => [daysAgo(6), daysAgo(0)] },
  { label: 'Last 30 days', range: () => [daysAgo(29), daysAgo(0)] },
  { label: 'This month', range: () => { const d = new Date(); return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), daysAgo(0)] } },
  { label: 'Last year', range: () => [daysAgo(MAX_RANGE_DAYS - 1), daysAgo(0)] },
]

export const rangeError = (from: string, to: string) =>
  !from || !to ? 'Pick both dates' : from > to ? 'From must be on or before To' : daysBetween(from, to) >= MAX_RANGE_DAYS ? `The range can be at most ${MAX_RANGE_DAYS} days` : ''
