import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { EmailService } from '@/lib/email-service'
import { ReminderScheduler } from '@/lib/reminder-scheduler'

// Admin endpoint for creating bookings on behalf of customers
// Supports booking outside normal availability (admin override)
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    
    const body = await request.json()
    const { customerId, serviceId, date, time, publicNotes } = body

    // Validate required fields
    if (!customerId || !serviceId || !date || !time) {
      return NextResponse.json({ 
        error: 'Missing required fields: customerId, serviceId, date, time' 
      }, { status: 400 })
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
    }

    // Validate time format (H:MM AM/PM or HH:MM:SS)
    const timeRegex24 = /^\d{2}:\d{2}(:\d{2})?$/
    const timeRegex12 = /^\d{1,2}:\d{2}\s*(AM|PM)$/i
    
    let time24: string
    if (timeRegex24.test(time)) {
      time24 = time.length === 5 ? `${time}:00` : time
    } else if (timeRegex12.test(time)) {
      // Convert 12-hour to 24-hour format
      const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
      if (!match) {
        return NextResponse.json({ error: 'Invalid time format' }, { status: 400 })
      }
      let hour = parseInt(match[1])
      const minute = match[2]
      const period = match[3].toUpperCase()
      
      if (period === 'PM' && hour !== 12) hour += 12
      if (period === 'AM' && hour === 12) hour = 0
      
      time24 = `${hour.toString().padStart(2, '0')}:${minute}:00`
    } else {
      return NextResponse.json({ error: 'Invalid time format. Use HH:MM or H:MM AM/PM' }, { status: 400 })
    }

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, email, phone, is_existing_customer')
      .eq('id', customerId)
      .single()

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single()

    if (serviceError || !service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Determine price based on customer type
    const isExistingCustomer = customer.is_existing_customer || false
    const priceCharged = isExistingCustomer ? service.existing_customer_price : service.new_customer_price

    // Create booking
    const bookingData = {
      customer_id: customerId,
      service_id: serviceId,
      booking_date: date,
      booking_time: time24,
      duration_minutes: service.duration_minutes,
      price_charged: priceCharged,
      customer_type_at_booking: isExistingCustomer ? 'loyalty' : 'new',
      payment_status: priceCharged === 0 ? 'paid' : 'pending',
      status: 'confirmed',
      public_notes: publicNotes || null,
      sms_confirmation_sent: false,
      sms_reminder_sent: false,
      sms_followup_sent: false
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingData)
      .select(`
        *,
        services (
          name,
          description,
          duration_minutes
        ),
        customers (
          name,
          email,
          phone,
          is_existing_customer
        )
      `)
      .single()

    if (bookingError) {
      console.error('Admin booking creation error:', bookingError)
      return NextResponse.json({ 
        error: 'Failed to create booking', 
        details: bookingError.message 
      }, { status: 500 })
    }

    // Create Google Calendar event if connected
    try {
      const googleCalendar = new GoogleCalendarService()
      const isConnected = await googleCalendar.isConnected()
      
      if (isConnected && booking) {
        await googleCalendar.createBookingEvent(booking)
      }
    } catch (error) {
      console.error('Error creating Google Calendar event:', error)
      // Don't fail the booking creation if calendar sync fails
    }

    // Send confirmation email and schedule reminders
    try {
      const emailService = new EmailService()
      const reminderScheduler = new ReminderScheduler()
      
      // Send confirmation email immediately
      const emailSent = await emailService.sendConfirmationEmail(booking)
      
      if (emailSent) {
        console.log('Confirmation email sent successfully for admin-created booking')
      }

      // Schedule all reminder templates for this booking
      await reminderScheduler.scheduleRemindersForBooking(booking)
      
    } catch (error) {
      console.error('Error sending confirmation email or scheduling reminders:', error)
      // Don't fail the booking creation if email/reminder scheduling fails
    }

    return NextResponse.json({ 
      success: true, 
      booking,
      message: 'Booking created successfully'
    })

  } catch (error) {
    console.error('Admin booking creation API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
