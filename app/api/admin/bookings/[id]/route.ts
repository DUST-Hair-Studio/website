import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'
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
          // Use timezone utilities for consistent date handling
          const startDate = createBusinessDateTime(booking_date, time24Hour)
          const endDate = calculateEndTime(booking_date, time24Hour, currentBooking.services.duration_minutes)
          
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
    const { status, admin_notes } = body

    const updateData: { updated_at: string; status?: string; admin_notes?: string } = {
      updated_at: new Date().toISOString()
    }

    if (status) {
      updateData.status = status
    }

    if (admin_notes !== undefined) {
      updateData.admin_notes = admin_notes
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating booking:', error)
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
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

    // First, get the booking to check if it has a Google Calendar event
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('google_calendar_event_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Error fetching booking for deletion:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
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
        // Continue with booking deletion even if calendar sync fails
      }
    }

    // Delete the booking from the database
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting booking:', error)
      return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Admin booking delete API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
