import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { EmailService } from '@/lib/email-service'
import { ReminderScheduler } from '@/lib/reminder-scheduler'
import { isFutureAppointment } from '@/lib/timezone-utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const body = await request.json()
    const { serviceId, date, time, customerInfo, isLoggedIn, waitlistId } = body

    // Debug logging for waitlist tracking
    if (waitlistId) {
      console.log('🎯 [WAITLIST TRACKING] Booking API received waitlistId:', waitlistId)
    }

    // Validate required fields
    if (!serviceId || !date || !time || !customerInfo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate that the appointment is in the future using timezone-aware check
    try {
      const isFuture = await isFutureAppointment(date, time)
      if (!isFuture) {
        return NextResponse.json({ error: 'Appointment must be scheduled for a future date and time' }, { status: 400 })
      }
    } catch (error) {
      console.error('Error validating future appointment:', error)
      return NextResponse.json({ error: 'Error validating appointment time' }, { status: 400 })
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

    // Get or create customer
    let customerId: string

    if (isLoggedIn) {
      // Get customer ID from auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }

      // Try to find customer by auth_user_id first, then email
      let customer = null
      let customerError = null
      
      const { data: customerByAuthId, error: errorByAuthId } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      
      if (customerByAuthId && !errorByAuthId) {
        customer = customerByAuthId
      } else {
        const { data: customerByEmail, error: errorByEmail } = await supabase
          .from('customers')
          .select('id')
          .eq('email', user.email)
          .single()
        
        if (customerByEmail && !errorByEmail) {
          customer = customerByEmail
        } else {
          customerError = errorByEmail
        }
      }

      if (customerError || !customer) {
        // If customer doesn't exist, create one
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({
            email: user.email!,
            auth_user_id: user.id,
            name: `${customerInfo.firstName || ''} ${customerInfo.lastName || ''}`.trim() || user.email!,
            phone: customerInfo.phone || '',
            is_existing_customer: false
          })
          .select('id')
          .single()

        if (createError) {
          console.error('Error creating customer:', createError)
          console.error('Customer data that failed:', {
            email: user.email,
            auth_user_id: user.id,
            name: `${customerInfo.firstName || ''} ${customerInfo.lastName || ''}`.trim() || user.email,
            phone: customerInfo.phone || '',
            is_existing_customer: false
          })
          return NextResponse.json({ 
            error: 'Failed to create customer',
            details: createError.message,
            code: createError.code
          }, { status: 500 })
        }

        customerId = newCustomer.id
      } else {
        customerId = customer.id
      }
    } else {
      // Create new customer or find existing one
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', customerInfo.email)
        .single()

      if (existingCustomer) {
        customerId = existingCustomer.id
      } else {
        // Create new customer
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({
            email: customerInfo.email,
            name: `${customerInfo.firstName} ${customerInfo.lastName}`.trim(),
            phone: customerInfo.phone,
            is_existing_customer: false
          })
          .select('id')
          .single()

        if (createError) {
          console.error('Error creating customer (non-logged in):', createError)
          console.error('Customer data that failed:', {
            email: customerInfo.email,
            name: `${customerInfo.firstName} ${customerInfo.lastName}`.trim(),
            phone: customerInfo.phone,
            is_existing_customer: false
          })
          return NextResponse.json({ 
            error: 'Failed to create customer',
            details: createError.message,
            code: createError.code
          }, { status: 500 })
        }

        customerId = newCustomer.id
      }
    }

    // Determine customer type and price
    const { data: customer } = await supabase
      .from('customers')
      .select('is_existing_customer')
      .eq('id', customerId)
      .single()

    const isExistingCustomer = customer?.is_existing_customer || false
    const priceCharged = isExistingCustomer ? service.existing_customer_price : service.new_customer_price


    // Create booking
    const bookingData = {
      customer_id: customerId,
      service_id: serviceId,
      booking_date: date,
      booking_time: time,
      duration_minutes: service.duration_minutes,
      price_charged: priceCharged,
      customer_type_at_booking: isExistingCustomer ? 'existing' : 'new',
      payment_status: 'pending',
      status: 'confirmed',
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
          duration_minutes
        ),
        customers (
          name,
          email,
          phone
        )
      `)
      .single()

    if (bookingError) {
      console.error('Booking creation error:', bookingError)
      console.error('Booking data that failed:', bookingData)
      return NextResponse.json({ 
        error: 'Failed to create booking', 
        details: bookingError.message,
        code: bookingError.code 
      }, { status: 500 })
    }

    // Handle waitlist conversion if this booking came from a waitlist notification
    if (waitlistId && booking) {
      try {
        console.log('🎯 [WAITLIST CONVERSION] Processing waitlist conversion for ID:', waitlistId)
        
        const { error: waitlistError } = await supabase
          .from('waitlist_requests')
          .update({
            status: 'converted',
            converted_at: new Date().toISOString(),
            converted_booking_id: booking.id
          })
          .eq('id', waitlistId)
        
        if (waitlistError) {
          console.error('❌ [WAITLIST CONVERSION] Error updating waitlist entry:', waitlistError)
        } else {
          console.log('✅ [WAITLIST CONVERSION] Successfully marked waitlist as converted')
        }
      } catch (error) {
        console.error('❌ [WAITLIST CONVERSION] Exception during waitlist conversion:', error)
        // Don't fail the booking if waitlist conversion fails
      }
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
        console.log('Confirmation email sent successfully')
      } else {
        console.log('Failed to send confirmation email')
      }

      // Schedule all reminder templates for this booking
      await reminderScheduler.scheduleRemindersForBooking(booking)
      
    } catch (error) {
      console.error('Error sending confirmation email or scheduling reminders:', error)
      // Don't fail the booking creation if email/reminder scheduling fails
    }

    // TODO: Generate Square payment link
    // TODO: Send SMS confirmation

    return NextResponse.json({ 
      success: true, 
      booking,
      message: 'Booking confirmed successfully'
    })

  } catch (error) {
    console.error('Booking API error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      body: body
    })
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get user's bookings (for logged in users)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', user.email)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        services (
          name,
          description,
          duration_minutes
        )
      `)
      .eq('customer_id', customer.id)
      .order('booking_date', { ascending: true })

    if (error) {
      console.error('Error fetching bookings:', error)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    return NextResponse.json({ bookings })

  } catch (error) {
    console.error('Bookings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
