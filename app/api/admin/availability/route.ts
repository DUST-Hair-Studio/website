import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'

// GET available time slots for a given date range
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const duration = parseInt(searchParams.get('duration') || '60')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 })
    }

    // Get business hours from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['business_hours', 'business_hours_timezone'])

    if (settingsError) {
      console.error('Error fetching business hours settings:', settingsError)
      return NextResponse.json({ error: 'Failed to fetch business hours' }, { status: 500 })
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
        is_open: dayData.is_open || false,
        open_time: dayData.start || '',
        close_time: dayData.end || '',
        timezone: timezone
      }
    }).filter(hours => hours.is_open)

    // Get existing bookings in the date range
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('booking_date, booking_time, services(duration_minutes)')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .in('status', ['pending', 'confirmed'])

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    // Get Google Calendar blocked time (if connected)
    let blockedTimeSlots: Array<{ date: string; start_time: string; end_time: string }> = []
    
    try {
      const googleCalendar = new GoogleCalendarService()
      const isConnected = await googleCalendar.isConnected()
      
      if (isConnected) {
        blockedTimeSlots = await googleCalendar.getBlockedTime(startDate, endDate)
      }
    } catch (error) {
      console.error('Error getting Google Calendar blocked time:', error)
      // Continue without blocked time if calendar sync fails
    }

    // Generate available time slots
    const availableSlots = generateAvailableSlots(
      startDate,
      endDate,
      businessHours,
      bookings,
      blockedTimeSlots,
      duration
    )

    return NextResponse.json({ availableSlots })
  } catch (error) {
    console.error('Availability API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateAvailableSlots(
  startDate: string,
  endDate: string,
  businessHours: Array<{ day_of_week: number; open_time: string; close_time: string; timezone: string }>,
  bookings: Array<{ booking_date: string; booking_time: string; services: { duration_minutes: number }[] | null }>,
  blockedTimeSlots: Array<{ date: string; start_time: string; end_time: string }>,
  duration: number
): Array<{ date: string; time: string; available: boolean }> {
  const slots: Array<{ date: string; time: string; available: boolean }> = []
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  // Create a map of business hours by day
  const hoursMap = businessHours.reduce((acc, hours) => {
    acc[hours.day_of_week] = {
      open_time: hours.open_time,
      close_time: hours.close_time,
      timezone: hours.timezone || 'America/Los_Angeles'
    }
    return acc
  }, {} as Record<number, { open_time: string; close_time: string; timezone: string }>)

  // Create a map of existing bookings by date and time
  const bookingsMap = bookings.reduce((acc, booking) => {
    const key = `${booking.booking_date}_${booking.booking_time}`
    acc[key] = booking.services?.[0]?.duration_minutes || 60
    return acc
  }, {} as Record<string, number>)

  // Generate slots for each day in the range
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
    const hours = hoursMap[dayOfWeek]
    
    if (!hours) continue // Skip days when not open
    
    const dateStr = date.toISOString().split('T')[0]
    
    // Generate 30-minute slots between open and close times
    const openTime = parseTime(hours.open_time)
    const closeTime = parseTime(hours.close_time)
    
    for (let time = new Date(openTime); time < closeTime; time.setMinutes(time.getMinutes() + 30)) {
      const timeStr = time.toTimeString().slice(0, 5)
      // Check if this slot conflicts with existing bookings
      const hasConflict = Object.keys(bookingsMap).some(bookingKey => {
        const [bookingDate, bookingTime] = bookingKey.split('_')
        if (bookingDate !== dateStr) return false
        
        const bookingStart = parseTime(bookingTime)
        const bookingDuration = bookingsMap[bookingKey]
        const bookingEnd = new Date(bookingStart.getTime() + bookingDuration * 60000)
        
        const slotStart = parseTime(timeStr)
        const slotEnd = new Date(slotStart.getTime() + duration * 60000)
        
        // Check for overlap
        return (slotStart < bookingEnd && slotEnd > bookingStart)
      })
      
      // Check if this slot conflicts with blocked time
      const hasBlockedTime = blockedTimeSlots.some(blocked => {
        if (blocked.date !== dateStr) return false
        
        const blockedStart = parseTime(blocked.start_time)
        const blockedEnd = parseTime(blocked.end_time)
        const slotStart = parseTime(timeStr)
        const slotEnd = new Date(slotStart.getTime() + duration * 60000)
        
        return (slotStart < blockedEnd && slotEnd > blockedStart)
      })
      
      slots.push({
        date: dateStr,
        time: timeStr,
        available: !hasConflict && !hasBlockedTime
      })
    }
  }
  
  return slots
}

function parseTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}
