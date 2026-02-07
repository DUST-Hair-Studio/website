import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { generateAvailableSlots } from '@/lib/schedule-utils'

// GET available time slots for a given date range
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

    // Get business hours and schedule settings
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

    // If booking start date is set, don't offer slots before that date
    let effectiveStartDate = startDate
    let effectiveEndDate = endDate
    if (bookingAvailableFromDate) {
      if (endDate < bookingAvailableFromDate) {
        return NextResponse.json({ availableSlots: [] })
      }
      if (startDate < bookingAvailableFromDate) {
        effectiveStartDate = bookingAvailableFromDate
      }
    }

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
      const hours = {
        day_of_week: day.value,
        is_open: dayData.is_open || false,
        open_time: dayData.start || '',
        close_time: dayData.end || '',
        timezone: timezone
      }
      console.log(`Day ${day.name} (${day.value}):`, dayData, '→', hours)
      return hours
    }).filter(hours => hours.is_open)
    
    console.log('Filtered business hours (open days only):', businessHours)

    // Get existing bookings in the date range
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('booking_date, booking_time, duration_minutes')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .in('status', ['pending', 'confirmed'])

    console.log('Availability API - Bookings query:', {
      startDate,
      endDate,
      bookingsFound: bookings?.length || 0,
      bookings: bookings
    })

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    // Get Google Calendar blocked time (if connected)
    let blockedTimeSlots: Array<{ date: string; start_time: string; end_time: string }> = []
    
    try {
      const googleCalendar = new GoogleCalendarService()
      const isConnected = await googleCalendar.isConnected()
      
      console.log('🔍 Google Calendar connection status:', isConnected)
      
      if (isConnected) {
        console.log('🔄 Fetching blocked time from Google Calendar...', { startDate, endDate })
        blockedTimeSlots = await googleCalendar.getBlockedTime(startDate, endDate)
        console.log('✅ Google Calendar blocked slots received:', blockedTimeSlots.length, blockedTimeSlots)
      } else {
        console.log('⚠️ Google Calendar not connected - no blocked time will be applied')
      }
    } catch (error) {
      console.error('🔴 Error getting Google Calendar blocked time:', error)
      // Continue without blocked time if calendar sync fails
    }

    // Transform bookings to the correct format for generateAvailableSlots
    const transformedBookings = bookings.map(b => ({
      date: b.booking_date,
      start_time: b.booking_time,
      duration_minutes: b.duration_minutes || 0
    }))

    console.log('Transformed bookings:', transformedBookings)

    // Debug logging
    console.log('Availability API Debug:', {
      startDate,
      endDate,
      duration,
      businessHoursCount: businessHours.length,
      businessHours,
      bookingsCount: transformedBookings.length,
      blockedTimeSlotsCount: blockedTimeSlots.length
    })

    // Generate available time slots
    const availableSlots = generateAvailableSlots(
      effectiveStartDate,
      effectiveEndDate,
      businessHours,
      transformedBookings,
      blockedTimeSlots,
      duration,
      bufferTime
    )

    console.log('Generated available slots:', availableSlots)
    console.log('Final response:', { availableSlots })

    return NextResponse.json({ availableSlots })
  } catch (error) {
    console.error('Availability API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

