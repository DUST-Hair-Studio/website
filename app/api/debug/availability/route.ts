import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'

// Debug endpoint to check availability issues
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Get business hours from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['business_hours', 'business_hours_timezone'])

    if (settingsError) {
      return NextResponse.json({ error: 'Failed to fetch settings', details: settingsError }, { status: 500 })
    }

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, unknown>)

    const businessHoursData = (settingsMap.business_hours as Record<string, { start?: string; end?: string; is_open?: boolean }>) || {}
    const timezone = (settingsMap.business_hours_timezone as string) || 'America/Los_Angeles'

    // Convert to array format
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
        day_name: day.name,
        is_open: dayData.is_open || false,
        open_time: dayData.start || '',
        close_time: dayData.end || '',
        timezone: timezone
      }
    })

    // Get existing bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('booking_date, booking_time, duration_minutes, status')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .in('status', ['pending', 'confirmed'])

    // Get Google Calendar blocked time
    let googleCalendarStatus = {
      isConnected: false,
      blockedSlots: [] as Array<{ date: string; start_time: string; end_time: string }>,
      error: null as string | null
    }
    
    try {
      const googleCalendar = new GoogleCalendarService()
      googleCalendarStatus.isConnected = await googleCalendar.isConnected()
      
      if (googleCalendarStatus.isConnected) {
        googleCalendarStatus.blockedSlots = await googleCalendar.getBlockedTime(startDate, endDate)
      }
    } catch (error) {
      googleCalendarStatus.error = error instanceof Error ? error.message : 'Unknown error'
    }

    return NextResponse.json({
      debug: {
        startDate,
        endDate,
        timezone,
        businessHoursData,
        businessHours,
        openDays: businessHours.filter(h => h.is_open),
        bookings: bookings || [],
        bookingsError: bookingsError,
        googleCalendar: googleCalendarStatus
      }
    })
  } catch (error) {
    console.error('Debug availability error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}
