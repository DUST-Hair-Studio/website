import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminSupabaseClient()
    const { id: bookingId } = await params
    
    // Fetch the booking with basic details (public endpoint)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_date,
        booking_time,
        duration_minutes,
        price_charged,
        payment_status,
        status,
        services (
          name,
          duration_minutes
        ),
        customers (
          name,
          email
        )
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json(booking)

  } catch (error) {
    console.error('Booking confirmation API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
