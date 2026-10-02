import type { SupabaseClient } from '@supabase/supabase-js'
import { formatYMD, type TrimBlockedRange } from '@/lib/trim-ranges'

// Customer-facing rule: at most one trim between full haircut appointments.
// Services opt in via services.trim_role ('haircut' resets the count, 'trim' is limited).
// Admin booking routes intentionally do not call this.

export type TrimRole = 'haircut' | 'trim'

interface TimelineEntry {
  id: string
  key: string // sortable "YYYY-MM-DD HH:MM"
  date: string
  role: TrimRole
}

const toKey = (date: string, time: string) => `${date} ${time.slice(0, 5)}`
const byKey = (a: TimelineEntry, b: TimelineEntry) => a.key.localeCompare(b.key)

// Customer's non-cancelled haircut/trim bookings, or null if the lookup failed
async function loadTimeline(supabase: SupabaseClient, customerId: string): Promise<TimelineEntry[] | null> {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, booking_date, booking_time, services!inner(trim_role)')
    .eq('customer_id', customerId)
    .neq('status', 'cancelled')
    .in('services.trim_role', ['haircut', 'trim'])

  if (error) {
    console.error('Trim limit: failed to load bookings:', error)
    return null
  }

  return (bookings || []).map((b) => {
    const svc = (Array.isArray(b.services) ? b.services[0] : b.services) as { trim_role: TrimRole }
    return { id: b.id, key: toKey(b.booking_date, b.booking_time), date: b.booking_date, role: svc.trim_role }
  })
}

// Number of trims beyond the first in each stretch between haircuts
function countExtraTrims(entries: TimelineEntry[]): number {
  let extra = 0
  let trimsSinceCut = 0
  for (const entry of [...entries].sort(byKey)) {
    if (entry.role === 'haircut') {
      trimsSinceCut = 0
    } else {
      trimsSinceCut++
      if (trimsSinceCut > 1) extra++
    }
  }
  return extra
}

export async function getServiceTrimRole(supabase: SupabaseClient, serviceId: string): Promise<TrimRole | null> {
  const { data: service } = await supabase
    .from('services')
    .select('trim_role')
    .eq('id', serviceId)
    .single()
  const role = service?.trim_role
  return role === 'haircut' || role === 'trim' ? role : null
}

/**
 * Date ranges in which this customer can't book another trim (each stretch between
 * haircuts that already holds a trim). Used by the booking UI to disable dates up front.
 */
export async function getTrimBlockedRanges(
  supabase: SupabaseClient,
  customerId: string,
  excludeBookingId?: string
): Promise<TrimBlockedRange[]> {
  const timeline = await loadTimeline(supabase, customerId)
  if (!timeline) return []

  const ranges: TrimBlockedRange[] = []
  let prevCut: string | null = null
  let firstTrim: string | null = null
  for (const entry of timeline.filter((e) => e.id !== excludeBookingId).sort(byKey)) {
    if (entry.role === 'haircut') {
      if (firstTrim) ranges.push({ from: prevCut, to: entry.date, trimDate: firstTrim })
      prevCut = entry.date
      firstTrim = null
    } else if (!firstTrim) {
      firstTrim = entry.date
    }
  }
  if (firstTrim) ranges.push({ from: prevCut, to: null, trimDate: firstTrim })
  return ranges
}

/**
 * Returns an error message if placing `serviceId` at `date`/`time` for this customer
 * would put more than one trim between haircuts, otherwise null.
 * Pass `excludeBookingId` when rescheduling so the booking's old slot is ignored.
 */
export async function checkTrimLimit(
  supabase: SupabaseClient,
  {
    customerId,
    serviceId,
    date,
    time,
    excludeBookingId,
  }: { customerId: string; serviceId: string; date: string; time: string; excludeBookingId?: string }
): Promise<string | null> {
  const role = await getServiceTrimRole(supabase, serviceId)
  if (!role) return null

  // Fail open: a lookup error shouldn't stop customers from booking
  const current = await loadTimeline(supabase, customerId)
  if (!current) return null

  // Baseline keeps a rescheduled booking at its original slot, so moving a haircut
  // that currently separates two trims is caught. Only block changes that add violations,
  // so extra trims an admin booked don't lock the customer out of unrelated bookings.
  const proposed: TimelineEntry = { id: 'proposed', key: toKey(date, time), date, role }
  const withProposed = [...current.filter((e) => e.id !== excludeBookingId), proposed]

  if (countExtraTrims(withProposed) <= countExtraTrims(current)) return null

  if (role === 'haircut') {
    return 'Moving this haircut to that date would leave more than one trim between haircuts. Please choose an earlier date, or contact us if you need an exception.'
  }

  // Find the trim the proposed slot collides with to give a specific message
  const sorted = withProposed.sort(byKey)
  const idx = sorted.indexOf(proposed)
  let conflict: TimelineEntry | undefined
  for (let i = idx - 1; i >= 0 && sorted[i].role === 'trim'; i--) conflict = sorted[i]
  for (let i = idx + 1; !conflict && i < sorted.length && sorted[i].role === 'trim'; i++) conflict = sorted[i]

  const base = 'Only one trim can be booked between haircut appointments.'
  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  return conflict
    ? `${base} You already have a trim on ${formatYMD(conflict.date, dateOpts)} with no haircut in between. Please book a haircut, or contact us if you need an exception.`
    : `${base} Please book a haircut, or contact us if you need an exception.`
}
