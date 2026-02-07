import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET business hours
export async function GET() {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['business_hours', 'business_hours_timezone', 'booking_available_from_date'])

    if (error) {
      console.error('Error fetching business hours settings:', error)
      return NextResponse.json({ error: 'Failed to fetch business hours' }, { status: 500 })
    }

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, unknown>)

    const businessHoursData = (settingsMap.business_hours as Record<string, { start?: string; end?: string; is_open?: boolean }>) || {}
    const timezone = (settingsMap.business_hours_timezone as string) || 'America/Los_Angeles'
    const bookingAvailableFromDate = (settingsMap.booking_available_from_date as string) || null

    // Convert to array format for the UI
    const DAYS = [
      { value: 0, name: 'Sunday', key: 'sunday' },
      { value: 1, name: 'Monday', key: 'monday' },
      { value: 2, name: 'Tuesday', key: 'tuesday' },
      { value: 3, name: 'Wednesday', key: 'wednesday' },
      { value: 4, name: 'Thursday', key: 'thursday' },
      { value: 5, name: 'Friday', key: 'friday' },
      { value: 6, name: 'Saturday', key: 'saturday' }
    ]

    const businessHours = DAYS.map(day => {
      const dayData = businessHoursData[day.key] || {}
      return {
        day_of_week: day.value,
        day_name: day.name,
        is_open: dayData.is_open || false,
        open_time: dayData.start || '',
        close_time: dayData.end || '',
        timezone: timezone
      }
    })

    return NextResponse.json({ businessHours, booking_available_from_date: bookingAvailableFromDate })
  } catch (error) {
    console.error('Admin business hours API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST/PUT business hours (upsert)
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { businessHours } = body

    if (!Array.isArray(businessHours)) {
      return NextResponse.json({ error: 'businessHours must be an array' }, { status: 400 })
    }

    // Validate business hours data
    for (const hours of businessHours) {
      if (typeof hours.day_of_week !== 'number' || hours.day_of_week < 0 || hours.day_of_week > 6) {
        return NextResponse.json({ error: 'Invalid day_of_week' }, { status: 400 })
      }
      if (typeof hours.is_open !== 'boolean') {
        return NextResponse.json({ error: 'is_open must be boolean' }, { status: 400 })
      }
      if (hours.is_open && (!hours.open_time || !hours.close_time)) {
        return NextResponse.json({ error: 'open_time and close_time required when is_open is true' }, { status: 400 })
      }
    }

    // Convert to Settings table format
    const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const businessHoursData: Record<string, { start: string; end: string; is_open: boolean }> = {}
    
    businessHours.forEach(hours => {
      const dayName = DAYS[hours.day_of_week]
      businessHoursData[dayName] = {
        start: hours.is_open ? hours.open_time : '',
        end: hours.is_open ? hours.close_time : '',
        is_open: hours.is_open
      }
    })

    // Update business_hours setting
    const { error: hoursError } = await supabase
      .from('settings')
      .upsert({
        key: 'business_hours',
        value: businessHoursData,
        updated_at: new Date().toISOString()
      })

    if (hoursError) {
      console.error('Error updating business hours setting:', hoursError)
      return NextResponse.json({ error: 'Failed to update business hours' }, { status: 500 })
    }

    // Update timezone setting if provided
    const timezone = businessHours[0]?.timezone || 'America/Los_Angeles'
    const { error: timezoneError } = await supabase
      .from('settings')
      .upsert({
        key: 'business_hours_timezone',
        value: timezone,
        updated_at: new Date().toISOString()
      })

    if (timezoneError) {
      console.error('Error updating timezone setting:', timezoneError)
      return NextResponse.json({ error: 'Failed to update timezone' }, { status: 500 })
    }

    return NextResponse.json({ businessHours })
  } catch (error) {
    console.error('Admin business hours update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
