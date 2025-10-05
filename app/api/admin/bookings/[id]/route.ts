import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { GoogleCalendarService } from '@/lib/google-calendar'

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
