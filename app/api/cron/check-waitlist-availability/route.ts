import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'

/**
 * Cron job to check waitlist availability
 * Runs daily to check if any slots have opened up for pending waitlist requests
 * 
 * To configure in Vercel:
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/check-waitlist-availability",
 *     "schedule": "0 2 * * *"
 *   }]
 * }
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max

export async function GET(request: NextRequest) {
  try {
    console.log('🔔 [WAITLIST CRON] Starting waitlist availability check')

    // Verify cron secret for security (optional but recommended)
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('❌ [WAITLIST CRON] Unauthorized: Invalid cron secret')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminSupabaseClient()
    const googleCalendar = new GoogleCalendarService()

    // Get all pending waitlist requests
    const { data: waitlistRequests, error: waitlistError } = await supabase
      .from('waitlist_requests')
      .select(`
        *,
        services (
          id,
          name,
          duration_minutes,
          is_active
        ),
        customers (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (waitlistError) {
      console.error('❌ [WAITLIST CRON] Error fetching waitlist requests:', waitlistError)
      return NextResponse.json({ error: 'Failed to fetch waitlist requests' }, { status: 500 })
    }

    if (!waitlistRequests || waitlistRequests.length === 0) {
      console.log('✅ [WAITLIST CRON] No pending waitlist requests')
      return NextResponse.json({ 
        message: 'No pending waitlist requests',
        processed: 0,
        notified: 0
      })
    }

    console.log(`🔍 [WAITLIST CRON] Found ${waitlistRequests.length} pending waitlist requests`)

    let notifiedCount = 0
    let processedCount = 0

    // Process each waitlist request
    for (const request of waitlistRequests) {
      try {
        processedCount++
        console.log(`\n📋 [WAITLIST CRON] Processing request ${processedCount}/${waitlistRequests.length}:`, {
          customer: request.customers.email,
          service: request.services.name,
          dateRange: `${request.start_date} to ${request.end_date}`
        })

        // Skip if service is inactive
        if (!request.services.is_active) {
          console.log('⏭️ [WAITLIST CRON] Skipping - service is inactive')
          continue
        }

        // Check availability for each day in the date range
        const availableSlots = await findAvailableSlots(
          supabase,
          googleCalendar,
          request.start_date,
          request.end_date,
          request.service_id,
          request.services.duration_minutes
        )

        if (availableSlots.length > 0) {
          console.log(`✅ [WAITLIST CRON] Found ${availableSlots.length} available slots!`)
          
          // Send notification email for the first available slot
          const firstSlot = availableSlots[0]
          const notificationSent = await sendWaitlistNotification(
            supabase,
            request,
            firstSlot.date,
            firstSlot.time
          )

          if (notificationSent) {
            notifiedCount++
            console.log(`✅ [WAITLIST CRON] Notified ${request.customers.email}`)
          }
        } else {
          console.log('ℹ️ [WAITLIST CRON] No available slots found')
        }

      } catch (error) {
        console.error(`❌ [WAITLIST CRON] Error processing request ${request.id}:`, error)
        // Continue with next request
      }
    }

    console.log(`\n🎉 [WAITLIST CRON] Completed! Processed ${processedCount}, Notified ${notifiedCount}`)

    return NextResponse.json({
      success: true,
      message: 'Waitlist check completed',
      processed: processedCount,
      notified: notifiedCount
    })

  } catch (error) {
    console.error('❌ [WAITLIST CRON] Fatal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Find available time slots for a service within a date range
 */
async function findAvailableSlots(
  supabase: any,
  googleCalendar: GoogleCalendarService,
  startDate: string,
  endDate: string,
  serviceId: string,
  durationMinutes: number
): Promise<Array<{ date: string; time: string }>> {
  const availableSlots: Array<{ date: string; time: string }> = []

  try {
    // Get business hours from settings (same as debug endpoint)
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['business_hours', 'business_hours_timezone'])

    if (settingsError) {
      console.error('❌ [WAITLIST CRON] Error fetching business hours settings:', settingsError)
      return []
    }

    const settingsMap = settings?.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, unknown>) || {}

    const businessHoursData = (settingsMap.business_hours as Record<string, { start?: string; end?: string; is_open?: boolean }>) || {}
    const timezone = (settingsMap.business_hours_timezone as string) || 'America/Los_Angeles'

    // Convert to array format (same as debug endpoint)
    const DAYS = [
      { key: 'sunday', day_of_week: 0 },
      { key: 'monday', day_of_week: 1 },
      { key: 'tuesday', day_of_week: 2 },
      { key: 'wednesday', day_of_week: 3 },
      { key: 'thursday', day_of_week: 4 },
      { key: 'friday', day_of_week: 5 },
      { key: 'saturday', day_of_week: 6 }
    ]

    const businessHours = DAYS.map(day => {
      const dayData = businessHoursData[day.key] || {}
      return {
        day_of_week: day.day_of_week,
        day_name: day.key,
        is_open: dayData.is_open || false,
        open_time: dayData.start || '',
        close_time: dayData.end || '',
        timezone
      }
    })

    if (businessHours.every(bh => !bh.is_open)) {
      console.log('⚠️ [WAITLIST CRON] No business hours configured (all days closed)')
      return []
    }

    console.log(`🔍 [WAITLIST CRON] Business hours loaded: ${businessHours.filter(bh => bh.is_open).length} open days`)

    // Get existing bookings in date range
    const { data: bookings } = await supabase
      .from('bookings')
      .select('booking_date, booking_time, duration_minutes, status')
      .gte('booking_date', startDate)
      .lte('booking_date', endDate)
      .in('status', ['confirmed', 'pending'])

    // Get Google Calendar blocked time
    const blockedTimes = await googleCalendar.getBlockedTime(startDate, endDate)
    console.log(`🔍 [WAITLIST CRON] Found ${blockedTimes.length} blocked time slots from Google Calendar`)

    // Check each day in the range
    const currentDate = new Date(startDate)
    const lastDate = new Date(endDate)

    while (currentDate <= lastDate) {
      const dateStr = currentDate.toISOString().split('T')[0]
      const dayOfWeek = currentDate.getDay() // 0 = Sunday, 6 = Saturday

      // Get business hours for this day
      const dayHours = businessHours.find(bh => bh.day_of_week === dayOfWeek && bh.is_open)

      if (!dayHours) {
        // Business is closed this day
        currentDate.setDate(currentDate.getDate() + 1)
        continue
      }

      // Generate potential time slots for this day
      const potentialSlots = generateTimeSlots(
        dayHours.open_time,
        dayHours.close_time,
        durationMinutes
      )

      // Check each potential slot against bookings and blocked time
      for (const slot of potentialSlots) {
        const isAvailable = checkSlotAvailability(
          dateStr,
          slot,
          durationMinutes,
          bookings || [],
          blockedTimes
        )

        if (isAvailable) {
          availableSlots.push({ date: dateStr, time: slot })
          
          // Only return first available slot per day to avoid spamming
          break
        }
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

  } catch (error) {
    console.error('❌ [WAITLIST CRON] Error finding available slots:', error)
  }

  return availableSlots
}

/**
 * Generate time slots between open and close time
 */
function generateTimeSlots(openTime: string, closeTime: string, durationMinutes: number): string[] {
  const slots: string[] = []
  
  const [openHour, openMinute] = openTime.split(':').map(Number)
  const [closeHour, closeMinute] = closeTime.split(':').map(Number)
  
  let currentMinutes = openHour * 60 + openMinute
  const closeMinutes = closeHour * 60 + closeMinute
  
  while (currentMinutes + durationMinutes <= closeMinutes) {
    const hour = Math.floor(currentMinutes / 60)
    const minute = currentMinutes % 60
    slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`)
    currentMinutes += 15 // 15-minute intervals
  }
  
  return slots
}

/**
 * Check if a time slot is available
 */
function checkSlotAvailability(
  date: string,
  time: string,
  durationMinutes: number,
  bookings: any[],
  blockedTimes: any[]
): boolean {
  // Check against existing bookings
  for (const booking of bookings) {
    if (booking.booking_date === date) {
      if (timeSlotsOverlap(time, durationMinutes, booking.booking_time, booking.duration_minutes)) {
        return false
      }
    }
  }

  // Check against Google Calendar blocked time
  for (const blocked of blockedTimes) {
    if (blocked.date === date) {
      // Handle all-day blocks
      if (blocked.start_time === '00:00:00' && blocked.end_time === '23:59:00') {
        return false
      }
      
      if (timeSlotsOverlap(time, durationMinutes, blocked.start_time, 
        getMinutesDifference(blocked.start_time, blocked.end_time))) {
        return false
      }
    }
  }

  return true
}

/**
 * Check if two time slots overlap
 */
function timeSlotsOverlap(
  time1: string,
  duration1: number,
  time2: string,
  duration2: number
): boolean {
  const start1 = timeToMinutes(time1)
  const end1 = start1 + duration1
  const start2 = timeToMinutes(time2)
  const end2 = start2 + duration2

  return start1 < end2 && start2 < end1
}

/**
 * Convert time string to minutes
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

/**
 * Get minutes difference between two times
 */
function getMinutesDifference(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime)
}

/**
 * Send waitlist notification email
 */
async function sendWaitlistNotification(
  supabase: any,
  request: any,
  availableDate: string,
  availableTime: string
): Promise<boolean> {
  try {
    // Import Resend
    const { Resend } = await import('resend')
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

    if (!resend) {
      console.log('⚠️ [WAITLIST CRON] Resend API key not configured')
      return false
    }

    // Check if email is enabled
    const { data: emailEnabled } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'email_enabled')
      .single()

    if (emailEnabled?.value === false) {
      console.log('⚠️ [WAITLIST CRON] Email notifications are disabled')
      return false
    }

    // Get business settings
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['business_name', 'business_phone', 'business_email', 'business_address', 'business_timezone'])

    const settingsMap = settings?.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>) || {}

    const businessSettings = {
      business_name: settingsMap.business_name || 'Your Business',
      business_phone: settingsMap.business_phone || '',
      business_email: settingsMap.business_email || 'noreply@yourbusiness.com',
      business_address: settingsMap.business_address || '',
      timezone: settingsMap.business_timezone || 'America/Los_Angeles'
    }

    // Format the date and time for display - avoid timezone conversion
    const formatDateForEmail = (dateString: string, timezone: string) => {
      // Parse YYYY-MM-DD format directly without timezone conversion
      const [year, month, day] = dateString.split('-').map(Number)
      const date = new Date(year, month - 1, day) // month is 0-indexed
      
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: timezone
      })
    }

    const appointmentDate = formatDateForEmail(availableDate, businessSettings.timezone)

    const appointmentTime = new Date(`${availableDate}T${availableTime}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: businessSettings.timezone
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const bookingLink = `${baseUrl}/book?serviceId=${request.service_id}&date=${availableDate}&waitlist_id=${request.id}`

    const subject = `Appointment Available - ${appointmentDate}`
    const message = `Hi ${request.customers.name},

Good news! An appointment slot has opened up for ${request.services.name}.

Available Date: ${appointmentDate}
Available Time: ${appointmentTime}

This appointment is available on a first-come, first-served basis. Book now to secure your spot!

To book this appointment, click the link below:
${bookingLink}

This notification is part of our waitlist service. You requested to be notified about availability between ${formatDateForEmail(request.start_date, businessSettings.timezone)} and ${formatDateForEmail(request.end_date, businessSettings.timezone)}.

Best regards,
${businessSettings.business_name}
${businessSettings.business_phone}`

    const htmlMessage = message.replace(/\n/g, '<br>')

    const { data, error } = await resend.emails.send({
      from: businessSettings.business_email,
      to: [request.customers.email],
      subject,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${subject}</h2>
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 600;">
              🎉 Great news! A spot has opened up!
            </p>
          </div>
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            ${htmlMessage}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${bookingLink}" style="display: inline-block; background-color: #1C1C1D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Book This Appointment
            </a>
          </div>
          <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666;">
            <p>⏰ This notification is time-sensitive. Book soon to secure your spot!</p>
            <p>If you have any questions, please contact us at ${businessSettings.business_phone}</p>
          </div>
        </div>
      `
    })

    if (error) {
      console.error('❌ [WAITLIST CRON] Error sending notification email:', error)
      return false
    }

    console.log('✅ [WAITLIST CRON] Notification email sent:', data?.id)

    // Update waitlist status to notified
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48) // 48 hour window to book

    await supabase
      .from('waitlist_requests')
      .update({
        status: 'notified',
        notified_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      })
      .eq('id', request.id)

    return true

  } catch (error) {
    console.error('❌ [WAITLIST CRON] Error in sendWaitlistNotification:', error)
    return false
  }
}

