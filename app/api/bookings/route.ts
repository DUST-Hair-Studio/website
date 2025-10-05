import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const body = await request.json()
    const { serviceId, date, time, customerInfo, isLoggedIn } = body

    // Validate required fields
    if (!serviceId || !date || !time || !customerInfo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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
            first_name: customerInfo.firstName || '',
            last_name: customerInfo.lastName || '',
            phone: customerInfo.phone || '',
            is_existing_customer: false
          })
          .select('id')
          .single()

        if (createError) {
          console.error('Error creating customer:', createError)
          return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
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
            first_name: customerInfo.firstName,
            last_name: customerInfo.lastName,
            phone: customerInfo.phone,
            is_existing_customer: false
          })
          .select('id')
          .single()

        if (createError) {
          return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 })
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
      status: 'pending',
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

    // TODO: Generate Square payment link
    // TODO: Send SMS confirmation

    return NextResponse.json({ 
      success: true, 
      booking,
      message: 'Booking created successfully'
    })

  } catch (error) {
    console.error('Booking API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
