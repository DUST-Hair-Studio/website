import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { getBusinessTodayString, getBusinessTimezone } from '@/lib/timezone-utils'

type FilterPeriod = 'all' | 'today' | '7d' | '30d' | '90d' | '12mo' | 'ytd'
type Direction = 'past' | 'future'

const ROLLING_DAYS: Record<'7d' | '30d' | '90d' | '12mo', number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12mo': 365,
}

const PROJECTION_DAYS = 30
const PAYMENT_STATUSES = ['paid', 'pending', 'refunded', 'void', 'cancelled'] as const
const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const
type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
type BookingStatus = (typeof BOOKING_STATUSES)[number]

interface BookingRow {
  id: string
  booking_date: string
  booking_time: string
  duration_minutes: number
  price_charged: number
  payment_status: PaymentStatus
  status: BookingStatus
  paid_at: string | null
  customers: { id: string; name: string; email: string } | null
  services: { id: string; name: string; category: string | null } | null
}

function shiftDate(yyyyMmDd: string, days: number): string {
  const d = new Date(`${yyyyMmDd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function parseList<T extends string>(raw: string | null, allowed: readonly T[]): T[] | null {
  if (!raw) return null
  const items = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  const valid = items.filter((s): s is T => (allowed as readonly string[]).includes(s))
  return valid.length > 0 ? valid : null
}

function pastWindow(filter: FilterPeriod, today: string, tomorrow: string): { start: string | null; endExclusive: string } {
  if (filter === 'all') return { start: null, endExclusive: tomorrow }
  if (filter === 'today') return { start: today, endExclusive: tomorrow }
  if (filter === 'ytd') {
    const year = parseInt(today.slice(0, 4), 10)
    return { start: `${year}-01-01`, endExclusive: tomorrow }
  }
  const days = ROLLING_DAYS[filter]
  return { start: shiftDate(tomorrow, -days), endExclusive: tomorrow }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)

    const validFilters: FilterPeriod[] = ['all', 'today', '7d', '30d', '90d', '12mo', 'ytd']
    const filterParam = (searchParams.get('period') || 'all') as FilterPeriod
    const period: FilterPeriod = validFilters.includes(filterParam) ? filterParam : 'all'

    const directionParam = searchParams.get('direction')
    const direction: Direction = directionParam === 'future' ? 'future' : 'past'

    const paymentStatusFilter = parseList(searchParams.get('paymentStatus'), PAYMENT_STATUSES)
    const statusFilter = parseList(searchParams.get('status'), BOOKING_STATUSES)

    const tz = await getBusinessTimezone()
    const today = getBusinessTodayString(tz)
    const tomorrow = shiftDate(today, 1)

    let dateStart: string | null
    let dateEndExclusive: string

    if (direction === 'future') {
      dateStart = tomorrow
      dateEndExclusive = shiftDate(tomorrow, PROJECTION_DAYS)
    } else {
      const w = pastWindow(period, today, tomorrow)
      dateStart = w.start
      dateEndExclusive = w.endExclusive
    }

    let query = supabase
      .from('bookings')
      .select(
        'id, booking_date, booking_time, duration_minutes, price_charged, payment_status, status, paid_at, customers(id, name, email), services(id, name, category)'
      )
      .lt('booking_date', dateEndExclusive)
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false })
      .limit(2000)

    if (dateStart) {
      query = query.gte('booking_date', dateStart)
    }
    if (paymentStatusFilter) {
      query = query.in('payment_status', paymentStatusFilter)
    }
    if (statusFilter) {
      query = query.in('status', statusFilter)
    }

    const { data, error } = await query.returns<BookingRow[]>()
    if (error) {
      console.error('Reports details error', error)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    const rows = data || []
    const revenue = rows
      .filter(r => r.payment_status === 'paid')
      .reduce((s, r) => s + (r.price_charged || 0), 0)
    const paidCount = rows.filter(r => r.payment_status === 'paid').length
    const totalAmount = rows.reduce((s, r) => s + (r.price_charged || 0), 0)
    const avgTicket = paidCount > 0 ? revenue / paidCount : 0

    return NextResponse.json({
      filters: {
        period,
        direction,
        paymentStatus: paymentStatusFilter ?? Array.from(PAYMENT_STATUSES),
        status: statusFilter ?? Array.from(BOOKING_STATUSES),
        dateStart,
        dateEndExclusive,
      },
      summary: {
        count: rows.length,
        revenue,
        paidCount,
        totalAmount,
        avgTicket,
      },
      bookings: rows.map(r => ({
        id: r.id,
        booking_date: r.booking_date,
        booking_time: r.booking_time,
        duration_minutes: r.duration_minutes,
        price_charged: r.price_charged,
        payment_status: r.payment_status,
        status: r.status,
        paid_at: r.paid_at,
        customer_name: r.customers?.name || 'Unknown',
        customer_email: r.customers?.email || '',
        service_name: r.services?.name || 'Unknown service',
        service_category: r.services?.category || null,
      })),
    })
  } catch (error) {
    console.error('Reports details API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
