import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { generateAvailableSlots } from '@/lib/schedule-utils'

/**
 * Public availability API — used by customer booking and reschedule flows.
 * Same logic as admin availability (business hours, Google blocks, one-time overrides).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || searchParams.get('start_date')
    const endDate = searchParams.get('endDate') || searchParams.get('end_date')
    const duration = parseInt(searchParams.get('serviceDuration') || searchParams.get('duration') || '60')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
    }

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

    let effectiveStartDate = startDate
    const effectiveEndDate = endDate
    if (bookingAvailableFromDate) {
      if (endDate < bookingAvailableFromDate) {
        return NextResponse.json({ availableSlots: [] })
      }
      if (startDate < bookingAvailableFromDate) {
        effectiveStartDate = bookingAvailableFromDate
      }
    }

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

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('booking_date, booking_time, duration_minutes')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .in('status', ['pending', 'confirmed'])

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    let blockedTimeSlots: Array<{ date: string; start_time: string; end_time: string }> = []
    try {
      const googleCalendar = new GoogleCalendarService()
      if (await googleCalendar.isConnected()) {
        blockedTimeSlots = await googleCalendar.getBlockedTime(startDate, endDate)
      }
    } catch (error) {
      console.error('Error getting Google Calendar blocked time:', error)
    }

    let availabilityOverrides: Array<{ date: string; open_time: string; close_time: string }> = []
    const { data: overrides } = await supabase
      .from('availability_overrides')
      .select('date, open_time, close_time')
      .gte('date', effectiveStartDate)
      .lte('date', effectiveEndDate)
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

    const availableSlots = generateAvailableSlots(
      effectiveStartDate,
      effectiveEndDate,
      businessHours,
      transformedBookings,
      blockedTimeSlots,
      duration,
      bufferTime,
      availabilityOverrides.length ? availabilityOverrides : undefined
    )

    return NextResponse.json({ availableSlots })
  } catch (error) {
    console.error('Availability API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
