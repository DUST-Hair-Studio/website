import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminSupabaseClient()
    const { id } = await params

    // Fetch customer's booking history with service details
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_date,
        booking_time,
        price_charged,
        payment_status,
        status,
        paid_at,
        square_transaction_id,
        public_notes,
        created_at,
        services (
          name,
          duration_minutes
        )
      `)
      .eq('customer_id', id)
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false })

    if (error) {
      console.error('Error fetching customer billing history:', error)
      return NextResponse.json({ error: 'Failed to fetch billing history' }, { status: 500 })
    }

    // Format the billing history data
    const billingHistory = bookings?.map(booking => {
      console.log('Booking services data:', booking.services)
      return {
        id: booking.id,
        date: booking.booking_date,
        time: booking.booking_time,
        service: Array.isArray(booking.services) && booking.services.length > 0 
          ? booking.services[0].name 
          : (typeof booking.services === 'object' && booking.services && 'name' in booking.services 
              ? (booking.services as { name: string }).name 
              : 'Unknown Service'),
        duration: Array.isArray(booking.services) && booking.services.length > 0 
          ? booking.services[0].duration_minutes 
          : (typeof booking.services === 'object' && booking.services && 'duration_minutes' in booking.services 
              ? (booking.services as { duration_minutes: number }).duration_minutes 
              : 0),
        amount: booking.price_charged,
        paymentStatus: booking.payment_status,
        bookingStatus: booking.status,
        paidAt: booking.paid_at,
        squareTransactionId: booking.square_transaction_id,
        publicNotes: booking.public_notes,
        createdAt: booking.created_at
      }
    }) || []

    return NextResponse.json({ billingHistory })

  } catch (error) {
    console.error('Admin customer billing history API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
