// Pure helpers shared by the server trim check and the customer booking UI.
// A blocked range spans the haircut dates around a stretch that already has a trim
// (inclusive; null = unbounded). Dates are YYYY-MM-DD.

export interface TrimBlockedRange {
  from: string | null
  to: string | null
  trimDate: string
}

export const isTrimDateBlocked = (ranges: TrimBlockedRange[], ymd: string) =>
  ranges.some((r) => (!r.from || ymd >= r.from) && (!r.to || ymd <= r.to))

const addDay = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return next.toISOString().slice(0, 10)
}

// First date on/after `start` where a trim can be booked, or null if none
export function firstUnblockedTrimDate(ranges: TrimBlockedRange[], start: string): string | null {
  let cursor = start
  for (let moved = true; moved; ) {
    moved = false
    for (const r of ranges) {
      if ((!r.from || cursor >= r.from) && (!r.to || cursor <= r.to)) {
        if (!r.to) return null
        cursor = addDay(r.to)
        moved = true
      }
    }
  }
  return cursor
}

export const toLocalYMD = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const formatYMD = (ymd: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', opts)
}
