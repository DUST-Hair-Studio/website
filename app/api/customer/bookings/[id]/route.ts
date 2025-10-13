import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { EmailService } from '@/lib/email-service'
import { createBusinessDateTime, getCurrentBusinessTime } from '@/lib/timezone-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id: bookingId } = await params
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Find the customer record
    let customer = null
    
    // First try: auth_user_id
    const { data: customerByAuthId, error: errorByAuthId } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    
    if (customerByAuthId && !errorByAuthId) {
      customer = customerByAuthId
    } else {
      // Second try: email (fallback)
      const { data: customerByEmail, error: errorByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', user.email)
        .single()
      
      if (customerByEmail && !errorByEmail) {
        customer = customerByEmail
      } else {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
    }

    // Fetch the specific booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
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
          phone
        )
      `)
      .eq('id', bookingId)
      .eq('customer_id', customer.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json({ booking })

  } catch (error) {
    console.error('Customer booking API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id: bookingId } = await params
    const { booking_date, booking_time } = await request.json()
    
    if (!booking_date || !booking_time) {
      return NextResponse.json({ error: 'Booking date and time are required' }, { status: 400 })
    }
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Find the customer record
    let customer = null
    
    // First try: auth_user_id
    const { data: customerByAuthId, error: errorByAuthId } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    
    if (customerByAuthId && !errorByAuthId) {
      customer = customerByAuthId
    } else {
      // Second try: email (fallback)
      const { data: customerByEmail, error: errorByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', user.email)
        .single()
      
      if (customerByEmail && !errorByEmail) {
        customer = customerByEmail
      } else {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
    }

    // Get the current booking to verify ownership and get details
    const { data: currentBooking, error: currentBookingError } = await supabase
      .from('bookings')
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
      .eq('id', bookingId)
      .eq('customer_id', customer.id)
      .single()

    if (currentBookingError || !currentBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Store old date and time for email
    const oldDate = currentBooking.booking_date
    const oldTime = currentBooking.booking_time

    console.log('🔍 Current booking data:', {
      id: currentBooking.id,
      google_calendar_event_id: currentBooking.google_calendar_event_id,
      hasEventId: !!currentBooking.google_calendar_event_id,
      allFields: Object.keys(currentBooking)
    })

    // Check if booking can be rescheduled
    const now = await getCurrentBusinessTime()
    const bookingDateTime = await createBusinessDateTime(currentBooking.booking_date, currentBooking.booking_time)
    
    if (bookingDateTime <= now) {
      return NextResponse.json({ error: 'Cannot reschedule past appointments' }, { status: 400 })
    }
    
    if (currentBooking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Only confirmed appointments can be rescheduled' }, { status: 400 })
    }

    // Update the booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        booking_date,
        booking_time,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
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
          phone
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating booking:', updateError)
      return NextResponse.json({ error: 'Failed to reschedule booking' }, { status: 500 })
    }

    // Update Google Calendar event if it exists
    try {
      const googleCalendar = new GoogleCalendarService()
      const isConnected = await googleCalendar.isConnected()
      
      console.log('🔍 Google Calendar Debug Info:', {
        isConnected,
        hasEventId: !!currentBooking.google_calendar_event_id,
        eventId: currentBooking.google_calendar_event_id,
        hasDuration: !!currentBooking.services?.duration_minutes,
        duration: currentBooking.services?.duration_minutes,
        bookingId: bookingId
      })
      
      if (isConnected && currentBooking.google_calendar_event_id && currentBooking.services?.duration_minutes) {
        console.log('🔄 Updating Google Calendar event for reschedule:', {
          eventId: currentBooking.google_calendar_event_id,
          bookingId: bookingId,
          isConnected,
          hasEventId: !!currentBooking.google_calendar_event_id,
          hasDuration: !!currentBooking.services?.duration_minutes
        })
        
        // Parse the date and time properly (consistent with createBookingEvent)
        console.log('🔍 Date parsing debug:', {
          booking_date,
          booking_time,
          dateType: typeof booking_date,
          timeType: typeof booking_time,
          dateValue: booking_date,
          timeValue: booking_time
        })
        
        // Convert 12-hour format to 24-hour format if needed
        const convertTo24Hour = (timeStr: string): string => {
          // If already in 24-hour format (HH:MM), return as is
          if (/^\d{1,2}:\d{2}$/.test(timeStr) && !timeStr.includes('AM') && !timeStr.includes('PM')) {
            return timeStr
          }
          
          // Parse 12-hour format (H:MM AM/PM)
          const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
          if (!match) {
            throw new Error(`Invalid time format: ${timeStr}`)
          }
          
          const [, hours, minutes, period] = match
          let hour24 = parseInt(hours, 10)
          
          if (period.toUpperCase() === 'AM') {
            if (hour24 === 12) hour24 = 0
          } else { // PM
            if (hour24 !== 12) hour24 += 12
          }
          
          return `${hour24.toString().padStart(2, '0')}:${minutes}`
        }
        
        const time24Hour = convertTo24Hour(booking_time)
        console.log('🔍 Time conversion:', {
          original: booking_time,
          converted: time24Hour
        })
        
        const startDate = new Date(`${booking_date}T${time24Hour}`)
        const endDate = new Date(startDate.getTime() + currentBooking.services.duration_minutes * 60000)
        
        console.log('🔍 Parsed dates:', {
          startDate: startDate.toString(),
          endDate: endDate.toString(),
          startDateValid: !isNaN(startDate.getTime()),
          endDateValid: !isNaN(endDate.getTime())
        })
        
        // Check if dates are valid before proceeding
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          console.error('❌ Invalid date parsing:', {
            booking_date,
            booking_time,
            startDate: startDate.toString(),
            endDate: endDate.toString()
          })
          throw new Error('Invalid date or time format')
        }
        
        console.log('📅 Calendar update details:', {
          originalDate: booking_date,
          originalTime: booking_time,
          parsedStartDate: startDate.toISOString(),
          parsedEndDate: endDate.toISOString(),
          durationMinutes: currentBooking.services.duration_minutes
        })
        
        const success = await googleCalendar.updateBookingEvent(currentBooking.google_calendar_event_id, {
          start: startDate,
          end: endDate
        })
        
        if (success) {
          console.log('✅ Google Calendar event updated successfully')
        } else {
          console.log('❌ Failed to update Google Calendar event')
        }
      } else {
        console.log('ℹ️ Skipping Google Calendar update:', {
          isConnected,
          hasEventId: !!currentBooking.google_calendar_event_id,
          hasDuration: !!currentBooking.services?.duration_minutes
        })
      }
    } catch (error) {
      console.error('Error updating Google Calendar event:', error)
      // Don't fail the reschedule if calendar sync fails
    }

    // Send reschedule email
    try {
      const emailService = new EmailService()
      const bookingData = {
        id: updatedBooking.id,
        booking_date: updatedBooking.booking_date,
        booking_time: updatedBooking.booking_time,
        duration_minutes: updatedBooking.duration_minutes,
        price_charged: updatedBooking.price_charged,
        services: {
          name: updatedBooking.services.name,
          duration_minutes: updatedBooking.services.duration_minutes
        },
        customers: {
          name: updatedBooking.customers.name,
          email: updatedBooking.customers.email,
          phone: updatedBooking.customers.phone
        }
      }
      await emailService.sendRescheduleEmail(bookingData, oldDate, oldTime)
    } catch (error) {
      console.error('Error sending reschedule email:', error)
      // Continue with the response even if email fails
    }

    return NextResponse.json({ 
      success: true,
      booking: updatedBooking,
      message: 'Booking rescheduled successfully'
    })

  } catch (error) {
    console.error('Customer booking reschedule API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id: bookingId } = await params
    const { status } = await request.json()
    
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }
    
    // Only allow cancellation for customers
    if (status !== 'cancelled') {
      return NextResponse.json({ error: 'Only cancellation is allowed for customers' }, { status: 400 })
    }
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Find the customer record
    let customer = null
    
    // First try: auth_user_id
    const { data: customerByAuthId, error: errorByAuthId } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    
    if (customerByAuthId && !errorByAuthId) {
      customer = customerByAuthId
    } else {
      // Second try: email (fallback)
      const { data: customerByEmail, error: errorByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', user.email)
        .single()
      
      if (customerByEmail && !errorByEmail) {
        customer = customerByEmail
      } else {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
    }

    // Get the current booking to verify ownership and check if it can be cancelled
    const { data: currentBooking, error: currentBookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (
          name,
          duration_minutes
        )
      `)
      .eq('id', bookingId)
      .eq('customer_id', customer.id)
      .single()

    if (currentBookingError || !currentBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Check if booking can be cancelled
    const now = await getCurrentBusinessTime()
    const bookingDateTime = await createBusinessDateTime(currentBooking.booking_date, currentBooking.booking_time)
    
    if (bookingDateTime <= now) {
      return NextResponse.json({ error: 'Cannot cancel past appointments' }, { status: 400 })
    }
    
    if (currentBooking.status === 'cancelled') {
      return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 })
    }
    
    if (currentBooking.status === 'completed') {
      return NextResponse.json({ error: 'Cannot cancel completed appointments' }, { status: 400 })
    }

    // Update the booking status to cancelled
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
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
          phone
        )
      `)
      .single()

    if (updateError) {
      console.error('Error cancelling booking:', updateError)
      return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
    }

    // Delete Google Calendar event if it exists
    try {
      if (currentBooking.google_calendar_event_id) {
        const googleCalendar = new GoogleCalendarService()
        const isConnected = await googleCalendar.isConnected()
        
        if (isConnected) {
          await googleCalendar.deleteBookingEvent(bookingId, currentBooking.google_calendar_event_id)
          console.log('✅ Google Calendar event deleted for cancelled booking')
        }
      }
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error)
      // Don't fail the cancellation if calendar sync fails
    }

    // Send cancellation email
    try {
      const emailService = new EmailService()
      const bookingData = {
        id: updatedBooking.id,
        booking_date: updatedBooking.booking_date,
        booking_time: updatedBooking.booking_time,
        duration_minutes: updatedBooking.duration_minutes,
        price_charged: updatedBooking.price_charged,
        services: {
          name: updatedBooking.services.name,
          duration_minutes: updatedBooking.services.duration_minutes
        },
        customers: {
          name: updatedBooking.customers.name,
          email: updatedBooking.customers.email,
          phone: updatedBooking.customers.phone
        }
      }
      await emailService.sendCancellationEmail(bookingData)
    } catch (error) {
      console.error('Error sending cancellation email:', error)
      // Continue with the response even if email fails
    }

    return NextResponse.json({ 
      success: true,
      booking: updatedBooking,
      message: 'Booking cancelled successfully'
    })

  } catch (error) {
    console.error('Customer booking cancellation API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id: bookingId } = await params
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Find the customer record
    let customer = null
    
    // First try: auth_user_id
    const { data: customerByAuthId, error: errorByAuthId } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    
    if (customerByAuthId && !errorByAuthId) {
      customer = customerByAuthId
    } else {
      // Second try: email (fallback)
      const { data: customerByEmail, error: errorByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', user.email)
        .single()
      
      if (customerByEmail && !errorByEmail) {
        customer = customerByEmail
      } else {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
    }

    // Get the current booking to verify ownership and check if it can be deleted
    const { data: currentBooking, error: currentBookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (
          name,
          duration_minutes
        )
      `)
      .eq('id', bookingId)
      .eq('customer_id', customer.id)
      .single()

    if (currentBookingError || !currentBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Check if booking can be deleted
    const now = await getCurrentBusinessTime()
    const bookingDateTime = await createBusinessDateTime(currentBooking.booking_date, currentBooking.booking_time)
    
    if (bookingDateTime <= now) {
      return NextResponse.json({ error: 'Cannot delete past appointments' }, { status: 400 })
    }
    
    if (currentBooking.status === 'completed') {
      return NextResponse.json({ error: 'Cannot delete completed appointments' }, { status: 400 })
    }

    // Delete Google Calendar event if it exists
    try {
      if (currentBooking.google_calendar_event_id) {
        const googleCalendar = new GoogleCalendarService()
        const isConnected = await googleCalendar.isConnected()
        
        if (isConnected) {
          await googleCalendar.deleteBookingEvent(bookingId, currentBooking.google_calendar_event_id)
          console.log('✅ Google Calendar event deleted for cancelled booking')
        }
      }
    } catch (error) {
      console.error('Error deleting Google Calendar event:', error)
      // Continue with booking deletion even if calendar sync fails
    }

    // Delete the booking from the database
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)

    if (deleteError) {
      console.error('Error deleting booking:', deleteError)
      return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Booking cancelled and removed successfully'
    })

  } catch (error) {
    console.error('Customer booking deletion API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
