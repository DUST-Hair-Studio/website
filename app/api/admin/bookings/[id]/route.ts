import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { EmailService } from '@/lib/email-service'
import { waitlistService } from '@/lib/waitlist-service'
import { createBusinessDateTime, calculateEndTime } from '@/lib/timezone-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params
    const { booking_date, booking_time } = await request.json()
    
    if (!booking_date || !booking_time) {
      return NextResponse.json({ error: 'Booking date and time are required' }, { status: 400 })
    }

    // Get the current booking with all related data
    const { data: currentBooking, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (
          id,
          name,
          duration_minutes
        ),
        customers (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('id', id)
      .single()

    if (fetchError || !currentBooking) {
      console.error('Error fetching booking:', fetchError)
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Store old date and time for email
    const oldDate = currentBooking.booking_date
    const oldTime = currentBooking.booking_time

    // Update the booking in the database
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        booking_date,
        booking_time,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        services (
          id,
          name,
          duration_minutes
        ),
        customers (
          id,
          name,
          email,
          phone
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating booking:', updateError)
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    // Update Google Calendar event if it exists
    console.log('🔍 Admin Reschedule - Google Calendar Debug:', {
      hasEventId: !!currentBooking.google_calendar_event_id,
      eventId: currentBooking.google_calendar_event_id,
      bookingId: id
    })
    
    if (currentBooking.google_calendar_event_id) {
      try {
        const googleCalendar = new GoogleCalendarService()
        const isConnected = await googleCalendar.isConnected()
        
        console.log('🔍 Admin Reschedule - Google Calendar Connection:', {
          isConnected,
          eventId: currentBooking.google_calendar_event_id
        })
        
        if (isConnected) {
          // Convert 12-hour format to 24-hour format if needed
          const convertTo24Hour = (timeStr: string): string => {
            // If already in 24-hour format (HH:MM or HH:MM:SS), return as HH:MM
            if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr) && !timeStr.includes('AM') && !timeStr.includes('PM')) {
              return timeStr.substring(0, 5)
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
          // Use timezone utilities for consistent date handling
          const startDate = await createBusinessDateTime(booking_date, time24Hour)
          const endDate = await calculateEndTime(booking_date, time24Hour, currentBooking.services.duration_minutes)
          
          console.log('🔍 Admin Reschedule - Date Conversion:', {
            originalTime: booking_time,
            convertedTime: time24Hour,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            duration: currentBooking.services.duration_minutes
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

          await googleCalendar.updateBookingEvent(
            currentBooking.google_calendar_event_id,
            {
              start: startDate,
              end: endDate
            }
          )
        }
      } catch (error) {
        console.error('Error updating Google Calendar event:', error)
        // Continue with the response even if calendar sync fails
      }
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
      try {
        await emailService.sendAdminNotificationEmail(bookingData, 'booking_rescheduled', {
          oldDate,
          oldTime,
        })
      } catch (adminErr) {
        console.error('Error sending admin reschedule notification:', adminErr)
      }
    } catch (error) {
      console.error('Error sending reschedule email:', error)
      // Continue with the response even if email fails
    }

    // Notify waitlist users about the freed up slot
    try {
      await waitlistService.notifyWaitlist({
        booking_date: oldDate,
        booking_time: oldTime,
        service_id: currentBooking.service_id
      })
    } catch (error) {
      console.error('Error notifying waitlist:', error)
      // Continue even if waitlist notification fails
    }

    return NextResponse.json({ booking: updatedBooking })

  } catch (error) {
    console.error('Admin booking reschedule API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params
    const body = await request.json()
    const {
      status,
      admin_notes,
      public_notes,
      payment_status,
      square_transaction_id,
      action,
      void_reason,
      service_id,
      customer_type,
    } = body

    const updateData: {
      updated_at: string;
      status?: string;
      admin_notes?: string;
      public_notes?: string;
      payment_status?: string;
      square_transaction_id?: string;
      paid_at?: string | null;
      voided_at?: string | null;
      void_reason?: string | null;
      service_id?: string;
      duration_minutes?: number;
      price_charged?: number;
      customer_type_at_booking?: string;
    } = {
      updated_at: new Date().toISOString()
    }

    // Edit booking pricing: change service and/or customer type, recalculate price.
    // Only legal while the booking is still pre-checkout (no invoice issued, not completed/cancelled).
    if (service_id !== undefined || customer_type !== undefined) {
      const { data: existing } = await supabase
        .from('bookings')
        .select('status, payment_status, service_id, customer_type_at_booking')
        .eq('id', id)
        .single()
      if (!existing) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }
      if (existing.status === 'completed' || existing.status === 'cancelled') {
        return NextResponse.json(
          { error: `Cannot edit a ${existing.status} booking.` },
          { status: 400 }
        )
      }
      if (existing.payment_status !== 'pending') {
        return NextResponse.json(
          { error: `Cannot edit pricing once an invoice has been generated (current: ${existing.payment_status}). Void the invoice first.` },
          { status: 400 }
        )
      }

      const targetServiceId = service_id ?? existing.service_id
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('id, duration_minutes, new_customer_price, existing_customer_price')
        .eq('id', targetServiceId)
        .single()
      if (serviceError || !service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      }

      let targetCustomerType = existing.customer_type_at_booking as string
      if (customer_type !== undefined) {
        // Normalize: 'loyalty' is a UI label; DB stores 'existing'.
        if (customer_type === 'new') {
          targetCustomerType = 'new'
        } else if (customer_type === 'existing' || customer_type === 'loyalty') {
          targetCustomerType = 'existing'
        } else {
          return NextResponse.json({ error: 'Invalid customer_type' }, { status: 400 })
        }
      }

      const isExisting = targetCustomerType === 'existing' || targetCustomerType === 'loyalty'
      updateData.service_id = targetServiceId
      updateData.duration_minutes = service.duration_minutes
      updateData.customer_type_at_booking = targetCustomerType
      updateData.price_charged = isExisting ? service.existing_customer_price : service.new_customer_price
    }

    // Void / unvoid actions: only legal on pending or void (respectively)
    if (action === 'void' || action === 'unvoid') {
      const { data: existing } = await supabase
        .from('bookings')
        .select('payment_status, price_charged, status')
        .eq('id', id)
        .single()
      if (!existing) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }
      if (action === 'void') {
        if (existing.payment_status !== 'pending') {
          return NextResponse.json(
            { error: 'Only pending invoices can be voided.' },
            { status: 400 }
          )
        }
        if (existing.status === 'cancelled') {
          return NextResponse.json(
            { error: 'Cancelled bookings already have their charge written off.' },
            { status: 400 }
          )
        }
        updateData.payment_status = 'void'
        updateData.voided_at = new Date().toISOString()
        updateData.void_reason = typeof void_reason === 'string' && void_reason.trim() ? void_reason.trim() : null
      } else {
        if (existing.payment_status !== 'void') {
          return NextResponse.json(
            { error: 'Only voided invoices can be restored.' },
            { status: 400 }
          )
        }
        updateData.payment_status = 'pending'
        updateData.voided_at = null
        updateData.void_reason = null
      }
    }

    if (status) {
      updateData.status = status
    }

    // When cancelling, only allow if not paid; auto-flip pending payment to cancelled
    if (status === 'cancelled') {
      const { data: existing } = await supabase
        .from('bookings')
        .select('payment_status')
        .eq('id', id)
        .single()
      if (existing?.payment_status === 'paid') {
        return NextResponse.json(
          { error: 'Cannot cancel a paid booking. Process a refund first if needed.' },
          { status: 400 }
        )
      }
      if (existing?.payment_status === 'pending') {
        updateData.payment_status = 'cancelled'
      }
    }

    if (admin_notes !== undefined) {
      updateData.admin_notes = admin_notes
    }

    if (public_notes !== undefined) {
      updateData.public_notes = public_notes
    }

    if (payment_status) {
      updateData.payment_status = payment_status
      // If marking as paid, set paid_at timestamp
      if (payment_status === 'paid') {
        updateData.paid_at = new Date().toISOString()
      }
    }

    if (square_transaction_id) {
      updateData.square_transaction_id = square_transaction_id
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
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

    if (error) {
      console.error('Error updating booking:', error)
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
    }

    // Send cancellation email and delete Google Calendar event if status changed to cancelled
    if (status === 'cancelled') {
      if (booking.google_calendar_event_id) {
        try {
          const googleCalendar = new GoogleCalendarService()
          const isConnected = await googleCalendar.isConnected()
          if (isConnected) {
            await googleCalendar.deleteBookingEvent(id, booking.google_calendar_event_id)
          }
        } catch (calError) {
          console.error('Error deleting Google Calendar event:', calError)
        }
      }
      try {
        const emailService = new EmailService()
        const bookingData = {
          id: booking.id,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          duration_minutes: booking.duration_minutes,
          price_charged: booking.price_charged,
          services: {
            name: booking.services.name,
            duration_minutes: booking.services.duration_minutes
          },
          customers: {
            name: booking.customers.name,
            email: booking.customers.email,
            phone: booking.customers.phone
          }
        }
        const result = await emailService.sendCancellationEmail(bookingData)
        console.log('[CancelBooking] sendCancellationEmail result:', result)
        try {
          await emailService.sendAdminNotificationEmail(bookingData, 'booking_cancelled')
        } catch (adminErr) {
          console.error('Error sending admin cancellation notification:', adminErr)
        }
      } catch (error) {
        console.error('[CancelBooking] sendCancellationEmail threw:', error)
        // Continue with the response even if email fails
      }

      // Notify waitlist users about the freed up slot
      try {
        await waitlistService.notifyWaitlist({
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          service_id: booking.service_id
        })
      } catch (error) {
        console.error('Error notifying waitlist:', error)
        // Continue even if waitlist notification fails
      }
    }

    return NextResponse.json({ booking })

  } catch (error) {
    console.error('Admin booking update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params

    // Get full booking details for soft-cancel side effects (calendar/email/waitlist)
    const { data: booking, error: fetchError } = await supabase
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
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching booking for cancellation:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
    }

    // Prevent cancellation of paid bookings
    if (booking?.payment_status === 'paid') {
      return NextResponse.json({ 
        error: 'Cannot cancel a booking that has been paid. Please contact support if this is an error.' 
      }, { status: 400 })
    }

    // Idempotency: if already cancelled, return success and keep data untouched.
    if (booking?.status === 'cancelled') {
      return NextResponse.json({ success: true, booking })
    }

    // Delete Google Calendar event if it exists
    if (booking?.google_calendar_event_id) {
      try {
        const googleCalendar = new GoogleCalendarService()
        const isConnected = await googleCalendar.isConnected()
        
        if (isConnected) {
          await googleCalendar.deleteBookingEvent(id, booking.google_calendar_event_id)
        }
      } catch (error) {
        console.error('Error deleting Google Calendar event:', error)
        // Continue with booking cancellation even if calendar sync fails
      }
    }

    // Soft-cancel booking instead of hard delete to preserve history/audit data.
    // Auto-flip pending payment to cancelled (so it stops counting as outstanding).
    const cancelUpdate: {
      status: string
      updated_at: string
      payment_status?: string
    } = {
      status: 'cancelled',
      updated_at: new Date().toISOString()
    }
    if (booking?.payment_status === 'pending') {
      cancelUpdate.payment_status = 'cancelled'
    }
    const { data: cancelledBooking, error } = await supabase
      .from('bookings')
      .update(cancelUpdate)
      .eq('id', id)
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

    if (error) {
      console.error('Error cancelling booking:', error)
      return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
    }

    // Send cancellation email
    try {
      const emailService = new EmailService()
      const bookingData = {
        id: cancelledBooking.id,
        booking_date: cancelledBooking.booking_date,
        booking_time: cancelledBooking.booking_time,
        duration_minutes: cancelledBooking.duration_minutes,
        price_charged: cancelledBooking.price_charged,
        services: {
          name: cancelledBooking.services.name,
          duration_minutes: cancelledBooking.services.duration_minutes
        },
        customers: {
          name: cancelledBooking.customers.name,
          email: cancelledBooking.customers.email,
          phone: cancelledBooking.customers.phone
        }
      }
      await emailService.sendCancellationEmail(bookingData)
      try {
        await emailService.sendAdminNotificationEmail(bookingData, 'booking_cancelled')
      } catch (adminErr) {
        console.error('Error sending admin cancellation notification:', adminErr)
      }
    } catch (emailError) {
      console.error('Error sending cancellation email from DELETE route:', emailError)
      // Continue regardless
    }

    // Notify waitlist users about the freed up slot
    try {
      await waitlistService.notifyWaitlist({
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        service_id: booking.service_id
      })
    } catch (error) {
      console.error('Error notifying waitlist:', error)
      // Continue even if waitlist notification fails
    }

    return NextResponse.json({ success: true, booking: cancelledBooking })

  } catch (error) {
    console.error('Admin booking delete API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
