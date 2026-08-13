import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { generateAvailableSlots } from '@/lib/schedule-utils'

/**
 * Next-available API — scans forward day by day and returns the first date that
 * has an open slot for the given service duration. Used by the "Find next
 * available appointment" button in the customer booking and reschedule flows.
 *
 * Reuses the exact same availability logic as /api/availability (business hours,
 * Google Calendar blocks, one-time overrides, booking-from date) so the slot it
 * returns is identical to what the per-day view would show.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const duration = parseInt(searchParams.get('serviceDuration') || searchParams.get('duration') || '60')
    const daysToScan = Math.min(parseInt(searchParams.get('daysToScan') || '120'), 365)

    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['business_hours', 'business_hours_timezone', 'buffer_time_minutes', 'booking_available_from_date'])

    if (settingsError) {
      console.error('Error fetching settings:', settingsError)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, unknown>)

    const businessHoursData = (settingsMap.business_hours as Record<string, { start?: string; end?: string; is_open?: boolean }>) || {}
    const timezone = (settingsMap.business_hours_timezone as string) || 'America/Los_Angeles'
    const bufferTime = (settingsMap.buffer_time_minutes as number) || 0
    const bookingAvailableFromDate = (settingsMap.booking_available_from_date as string) || null

    const DAYS = [
      { value: 0, name: 'sunday' },
      { value: 1, name: 'monday' },
      { value: 2, name: 'tuesday' },
      { value: 3, name: 'wednesday' },
      { value: 4, name: 'thursday' },
      { value: 5, name: 'friday' },
      { value: 6, name: 'saturday' }
    ]

    const businessHours = DAYS.map(day => {
      const dayData = businessHoursData[day.name] || {}
      return {
        day_of_week: day.value,
        is_open: dayData.is_open || false,
        open_time: dayData.start || '',
        close_time: dayData.end || '',
        timezone: timezone
      }
    }).filter(hours => hours.is_open)

    // "Today" and current time relative to the business timezone (not the server's)
    const now = new Date()
    const tzDateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now)
    const todayStr = `${tzDateParts.find(p => p.type === 'year')!.value}-${tzDateParts.find(p => p.type === 'month')!.value}-${tzDateParts.find(p => p.type === 'day')!.value}`
    const tzTimeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit'
    }).formatToParts(now)
    const nowMinutes = parseInt(tzTimeParts.find(p => p.type === 'hour')!.value) * 60 + parseInt(tzTimeParts.find(p => p.type === 'minute')!.value)

    const fromParam = searchParams.get('fromDate') || searchParams.get('startDate')
    // Start no earlier than today, the requested date, or the booking-available-from date
    let effectiveStart = todayStr
    if (fromParam && fromParam > effectiveStart) effectiveStart = fromParam
    if (bookingAvailableFromDate && bookingAvailableFromDate > effectiveStart) effectiveStart = bookingAvailableFromDate

    // End of scan window
    const endDateObj = new Date(effectiveStart + 'T00:00:00')
    endDateObj.setDate(endDateObj.getDate() + daysToScan)
    const toYMD = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const scanEnd = toYMD(endDateObj)

    // Fetch bookings, blocks and overrides once for the whole scan window
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('booking_date, booking_time, duration_minutes')
      .gte('booking_date', effectiveStart)
      .lte('booking_date', scanEnd)
      .in('status', ['pending', 'confirmed'])

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    let blockedTimeSlots: Array<{ date: string; start_time: string; end_time: string }> = []
    try {
      const googleCalendar = new GoogleCalendarService()
      if (await googleCalendar.isConnected()) {
        blockedTimeSlots = await googleCalendar.getBlockedTime(effectiveStart, scanEnd)
      }
    } catch (error) {
      console.error('Error getting Google Calendar blocked time:', error)
    }

    let availabilityOverrides: Array<{ date: string; open_time: string; close_time: string }> = []
    const { data: overrides } = await supabase
      .from('availability_overrides')
      .select('date, open_time, close_time')
      .gte('date', effectiveStart)
      .lte('date', scanEnd)
    if (overrides?.length) {
      availabilityOverrides = overrides.map(o => ({
        date: typeof o.date === 'string' ? o.date.slice(0, 10) : o.date,
        open_time: o.open_time || '11:00',
        close_time: o.close_time || '21:00'
      }))
    }

    const transformedBookings = (bookings ?? []).map(b => ({
      date: b.booking_date,
      start_time: b.booking_time,
      duration_minutes: b.duration_minutes || 0
    }))

    // Parse a "9:00 AM" display slot into minutes-from-midnight (for today filtering)
    const slotToMinutes = (slot: string): number => {
      const m = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
      if (!m) return 0
      let hours = parseInt(m[1])
      const minutes = parseInt(m[2])
      const period = m[3].toUpperCase()
      if (period === 'PM' && hours !== 12) hours += 12
      if (period === 'AM' && hours === 12) hours = 0
      return hours * 60 + minutes
    }

    // Scan forward one day at a time; return the first day with an open slot
    const cursor = new Date(effectiveStart + 'T00:00:00')
    const end = new Date(scanEnd + 'T00:00:00')
    while (cursor <= end) {
      const dateStr = toYMD(cursor)
      let slots = generateAvailableSlots(
        dateStr,
        dateStr,
        businessHours,
        transformedBookings,
        blockedTimeSlots,
        duration,
        bufferTime,
        availabilityOverrides.length ? availabilityOverrides : undefined
      )

      // For today, drop slots whose start time has already passed
      if (dateStr === todayStr) {
        slots = slots.filter(s => slotToMinutes(s) > nowMinutes)
      }

      if (slots.length > 0) {
        return NextResponse.json({ date: dateStr, time: slots[0], slots })
      }

      cursor.setDate(cursor.getDate() + 1)
    }

    // Nothing open within the scan window
    return NextResponse.json({ date: null, time: null, slots: [] })
  } catch (error) {
    console.error('Next-available API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
