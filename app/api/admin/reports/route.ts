import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { getBusinessTodayString, getBusinessTimezone } from '@/lib/timezone-utils'

type FilterPeriod = 'all' | 'today' | '7d' | '30d' | '90d' | '12mo' | 'ytd'

const ROLLING_DAYS: Record<'7d' | '30d' | '90d' | '12mo', number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12mo': 365,
}

const PROJECTION_DAYS = 30
const QUERY_LIMIT = 50000

interface BookingRow {
  id: string
  customer_id: string
  service_id: string
  booking_date: string
  booking_time: string
  duration_minutes: number
  price_charged: number
  customer_type_at_booking: 'new' | 'loyalty' | 'existing'
  payment_status: 'pending' | 'paid' | 'refunded' | 'void' | 'cancelled'
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  services: { id: string; name: string; category: string | null } | null
}

function shiftDate(yyyyMmDd: string, days: number): string {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null
  return ((current - prior) / prior) * 100
}

function inRange(date: string, start: string | null, endExclusive: string): boolean {
  if (start && date < start) return false
  return date < endExclusive
}

interface Windows {
  currentStart: string | null
  currentEnd: string
  priorStart?: string
  priorEnd?: string
  hasPrior: boolean
}

function getWindows(filter: FilterPeriod, today: string, tomorrow: string): Windows {
  if (filter === 'all') {
    return { currentStart: null, currentEnd: tomorrow, hasPrior: false }
  }
  if (filter === 'today') {
    return { currentStart: today, currentEnd: tomorrow, hasPrior: false }
  }
  if (filter === 'ytd') {
    const year = parseInt(today.slice(0, 4), 10)
    const monthDay = today.slice(5)
    const currentStart = `${year}-01-01`
    const priorStart = `${year - 1}-01-01`
    const priorEnd = shiftDate(`${year - 1}-${monthDay}`, 1)
    return { currentStart, currentEnd: tomorrow, priorStart, priorEnd, hasPrior: true }
  }
  const days = ROLLING_DAYS[filter]
  const currentStart = shiftDate(tomorrow, -days)
  const priorStart = shiftDate(currentStart, -days)
  return { currentStart, currentEnd: tomorrow, priorStart, priorEnd: currentStart, hasPrior: true }
}

function summarize(bookings: BookingRow[]) {
  const paid = bookings.filter(b => b.payment_status === 'paid')
  const cancelled = bookings.filter(b => b.status === 'cancelled')
  const nonCancelled = bookings.filter(b => b.status !== 'cancelled')
  const voided = bookings.filter(b => b.payment_status === 'void')
  const cancelledPayments = bookings.filter(b => b.payment_status === 'cancelled')
  const revenue = paid.reduce((s, b) => s + (b.price_charged || 0), 0)
  const volume = paid.length
  const avgTicket = volume > 0 ? revenue / volume : 0
  const newRevenue = paid
    .filter(b => b.customer_type_at_booking === 'new')
    .reduce((s, b) => s + (b.price_charged || 0), 0)
  const loyaltyRevenue = revenue - newRevenue
  const newCount = paid.filter(b => b.customer_type_at_booking === 'new').length
  const loyaltyCount = volume - newCount
  const totalBookings = bookings.length
  const cancellationRate = totalBookings > 0 ? (cancelled.length / totalBookings) * 100 : 0
  const bookedMinutes = nonCancelled.reduce((s, b) => s + (b.duration_minutes || 0), 0)
  const voidedAmount = voided.reduce((s, b) => s + (b.price_charged || 0), 0)
  const cancelledAmount = cancelledPayments.reduce((s, b) => s + (b.price_charged || 0), 0)
  return {
    revenue,
    volume,
    avgTicket,
    newRevenue,
    loyaltyRevenue,
    newCount,
    loyaltyCount,
    cancellationRate,
    bookedMinutes,
    voidedCount: voided.length,
    voidedAmount,
    cancelledPaymentCount: cancelledPayments.length,
    cancelledPaymentAmount: cancelledAmount,
  }
}

function categoryBreakdown(bookings: BookingRow[], allCategories: string[]) {
  const paid = bookings.filter(b => b.payment_status === 'paid')
  const map = new Map<string, { revenue: number; volume: number }>()
  for (const cat of allCategories) {
    map.set(cat, { revenue: 0, volume: 0 })
  }
  for (const b of paid) {
    const cat = b.services?.category?.trim() || 'Uncategorized'
    const cur = map.get(cat) || { revenue: 0, volume: 0 }
    cur.revenue += b.price_charged || 0
    cur.volume += 1
    map.set(cat, cur)
  }
  return Array.from(map.entries())
    .map(([category, v]) => ({ category, revenue: v.revenue, volume: v.volume }))
    .sort((a, b) => b.revenue - a.revenue)
}

function topServices(bookings: BookingRow[], limit = 5) {
  const paid = bookings.filter(b => b.payment_status === 'paid')
  const map = new Map<string, { name: string; revenue: number; volume: number }>()
  for (const b of paid) {
    const id = b.service_id
    const name = b.services?.name || 'Unknown service'
    const cur = map.get(id) || { name, revenue: 0, volume: 0 }
    cur.revenue += b.price_charged || 0
    cur.volume += 1
    map.set(id, cur)
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

interface BusinessHoursMap {
  [day: string]: { start?: string; end?: string; is_open?: boolean }
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function dayOfWeekName(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`)
  return DAY_NAMES[d.getUTCDay()]
}

function availableMinutesInRange(
  startInclusive: string,
  endExclusive: string,
  businessHours: BusinessHoursMap,
  overrides: Array<{ date: string; open_time: string; close_time: string }>,
): number {
  const overrideMap = new Map(overrides.map(o => [o.date, o]))
  let total = 0
  let cursor = startInclusive
  while (cursor < endExclusive) {
    const ov = overrideMap.get(cursor)
    if (ov) {
      total += Math.max(0, timeToMinutes(ov.close_time) - timeToMinutes(ov.open_time))
    } else {
      const dow = dayOfWeekName(cursor)
      const cfg = businessHours[dow]
      if (cfg?.is_open && cfg.start && cfg.end) {
        total += Math.max(0, timeToMinutes(cfg.end) - timeToMinutes(cfg.start))
      }
    }
    cursor = shiftDate(cursor, 1)
  }
  return total
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const validFilters: FilterPeriod[] = ['all', 'today', '7d', '30d', '90d', '12mo', 'ytd']
    const filterParam = (searchParams.get('period') || 'all') as FilterPeriod
    const filter: FilterPeriod = validFilters.includes(filterParam) ? filterParam : 'all'

    const tz = await getBusinessTimezone()
    const today = getBusinessTodayString(tz)
    const tomorrow = shiftDate(today, 1)

    const windows = getWindows(filter, today, tomorrow)
    const projectionEnd = shiftDate(tomorrow, PROJECTION_DAYS)

    // Lower bound for the booking range query
    const lowerBound = windows.hasPrior ? windows.priorStart! : windows.currentStart

    let bookingsQuery = supabase
      .from('bookings')
      .select(
        'id, customer_id, service_id, booking_date, booking_time, duration_minutes, price_charged, customer_type_at_booking, payment_status, status, services(id, name, category)'
      )
      .lt('booking_date', windows.currentEnd)
      .limit(QUERY_LIMIT)

    if (lowerBound) {
      bookingsQuery = bookingsQuery.gte('booking_date', lowerBound)
    }

    const { data: rangeBookings, error: rangeErr } = await bookingsQuery.returns<BookingRow[]>()
    if (rangeErr) {
      console.error('Reports: range bookings error', rangeErr)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    const { data: futureBookings, error: futureErr } = await supabase
      .from('bookings')
      .select('booking_date, price_charged, status')
      .gte('booking_date', tomorrow)
      .lt('booking_date', projectionEnd)
      .in('status', ['pending', 'confirmed'])

    if (futureErr) {
      console.error('Reports: future bookings error', futureErr)
      return NextResponse.json({ error: 'Failed to fetch future bookings' }, { status: 500 })
    }

    const all = rangeBookings || []
    const currentBookings = all.filter(b => inRange(b.booking_date, windows.currentStart, windows.currentEnd))
    const priorBookings = windows.hasPrior
      ? all.filter(b => b.booking_date >= windows.priorStart! && b.booking_date < windows.priorEnd!)
      : []

    // Active service categories (zero-fill in legend)
    const { data: serviceRows } = await supabase
      .from('services')
      .select('category')
      .eq('is_active', true)
    const allCategories = Array.from(
      new Set(
        (serviceRows || [])
          .map(s => (typeof s.category === 'string' ? s.category.trim() : ''))
          .filter(c => c.length > 0)
      )
    )
    if (
      all.some(b => !b.services?.category || !b.services.category.trim()) &&
      !allCategories.includes('Uncategorized')
    ) {
      allCategories.push('Uncategorized')
    }

    const currentSummary = summarize(currentBookings)
    const priorSummary = windows.hasPrior ? summarize(priorBookings) : null

    // Outstanding revenue (pending payment, non-cancelled)
    const outstanding = currentBookings
      .filter(b => b.status !== 'cancelled' && b.payment_status === 'pending')
      .reduce((s, b) => s + (b.price_charged || 0), 0)
    const outstandingPrior = windows.hasPrior
      ? priorBookings
          .filter(b => b.status !== 'cancelled' && b.payment_status === 'pending')
          .reduce((s, b) => s + (b.price_charged || 0), 0)
      : null

    // Capacity utilization
    const { data: settingsRows } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['business_hours'])
    const businessHours = ((settingsRows || []).find(r => r.key === 'business_hours')?.value as BusinessHoursMap) || {}

    // For 'all', anchor capacity to the earliest booking date; otherwise the window start.
    let capacityStart = windows.currentStart
    if (capacityStart === null) {
      const earliest = all.reduce<string | null>(
        (min, b) => (!min || b.booking_date < min ? b.booking_date : min),
        null
      )
      capacityStart = earliest || today
    }

    const overrideLowerBound = windows.priorStart || capacityStart
    const { data: overrideRows } = await supabase
      .from('availability_overrides')
      .select('date, open_time, close_time')
      .gte('date', overrideLowerBound)
      .lt('date', windows.currentEnd)
    const overrides = (overrideRows || []).map(o => ({
      date: typeof o.date === 'string' ? o.date.slice(0, 10) : o.date,
      open_time: o.open_time || '00:00',
      close_time: o.close_time || '00:00',
    }))

    const currentAvailable = availableMinutesInRange(capacityStart, windows.currentEnd, businessHours, overrides)
    const currentUtilization = currentAvailable > 0 ? (currentSummary.bookedMinutes / currentAvailable) * 100 : 0

    let priorUtilization: number | null = null
    if (windows.hasPrior && priorSummary) {
      const priorAvailable = availableMinutesInRange(windows.priorStart!, windows.priorEnd!, businessHours, overrides)
      priorUtilization = priorAvailable > 0 ? (priorSummary.bookedMinutes / priorAvailable) * 100 : 0
    }

    // Retention: of customers whose first 'new' booking is in the window, % with any later booking
    async function computeRetention(newBookings: BookingRow[]) {
      const customerIds = Array.from(new Set(newBookings.map(b => b.customer_id)))
      if (customerIds.length === 0) return { rate: 0, retained: 0, total: 0 }
      const firstByCustomer = new Map<string, string>()
      for (const b of newBookings) {
        const prev = firstByCustomer.get(b.customer_id)
        if (!prev || b.booking_date < prev) firstByCustomer.set(b.customer_id, b.booking_date)
      }
      const { data: subsequent } = await supabase
        .from('bookings')
        .select('customer_id, booking_date, status')
        .in('customer_id', customerIds)
        .neq('status', 'cancelled')
      const retained = new Set<string>()
      for (const row of subsequent || []) {
        const first = firstByCustomer.get(row.customer_id)
        if (first && row.booking_date > first) retained.add(row.customer_id)
      }
      return {
        rate: (retained.size / customerIds.length) * 100,
        retained: retained.size,
        total: customerIds.length,
      }
    }

    const newCurrent = currentBookings.filter(b => b.customer_type_at_booking === 'new')
    const newPrior = priorBookings.filter(b => b.customer_type_at_booking === 'new')
    const retentionCurrent = await computeRetention(newCurrent)
    const retentionPrior = windows.hasPrior ? await computeRetention(newPrior) : null

    const projectedRevenue = (futureBookings || []).reduce((s, b) => s + (b.price_charged || 0), 0)
    const projectedCount = (futureBookings || []).length

    const buildKpi = (current: number, prior: number | null) =>
      prior === null
        ? { current }
        : { current, prior, pctChange: pctChange(current, prior) }

    return NextResponse.json({
      filter,
      hasComparison: windows.hasPrior,
      windows: {
        current: { start: windows.currentStart, endExclusive: windows.currentEnd },
        prior: windows.hasPrior
          ? { start: windows.priorStart, endExclusive: windows.priorEnd }
          : null,
        future: { start: tomorrow, endExclusive: projectionEnd },
      },
      kpis: {
        revenue: buildKpi(currentSummary.revenue, priorSummary?.revenue ?? null),
        volume: buildKpi(currentSummary.volume, priorSummary?.volume ?? null),
        avgTicket: buildKpi(currentSummary.avgTicket, priorSummary?.avgTicket ?? null),
        newVsLoyalty: {
          current: {
            newRevenue: currentSummary.newRevenue,
            loyaltyRevenue: currentSummary.loyaltyRevenue,
            newCount: currentSummary.newCount,
            loyaltyCount: currentSummary.loyaltyCount,
          },
          prior: priorSummary
            ? {
                newRevenue: priorSummary.newRevenue,
                loyaltyRevenue: priorSummary.loyaltyRevenue,
                newCount: priorSummary.newCount,
                loyaltyCount: priorSummary.loyaltyCount,
              }
            : null,
        },
        cancellationRate: buildKpi(
          currentSummary.cancellationRate,
          priorSummary?.cancellationRate ?? null,
        ),
        utilization: {
          ...buildKpi(currentUtilization, priorUtilization),
          currentAvailableMinutes: currentAvailable,
          currentBookedMinutes: currentSummary.bookedMinutes,
        },
        retention: {
          current: retentionCurrent,
          prior: retentionPrior,
          pctChange: retentionPrior ? pctChange(retentionCurrent.rate, retentionPrior.rate) : null,
        },
        outstanding: buildKpi(outstanding, outstandingPrior),
        projected: {
          revenue: projectedRevenue,
          count: projectedCount,
          days: PROJECTION_DAYS,
        },
        voided: {
          count: currentSummary.voidedCount,
          amount: currentSummary.voidedAmount,
          prior: priorSummary
            ? { count: priorSummary.voidedCount, amount: priorSummary.voidedAmount }
            : null,
        },
        cancelledPayments: {
          count: currentSummary.cancelledPaymentCount,
          amount: currentSummary.cancelledPaymentAmount,
          prior: priorSummary
            ? { count: priorSummary.cancelledPaymentCount, amount: priorSummary.cancelledPaymentAmount }
            : null,
        },
      },
      categories: {
        current: categoryBreakdown(currentBookings, allCategories),
        prior: priorSummary ? categoryBreakdown(priorBookings, allCategories) : null,
      },
      topServices: topServices(currentBookings, 5),
    })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
