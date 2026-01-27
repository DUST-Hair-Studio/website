import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Lightweight endpoint for fetching bookings on a specific date
// Used by admin override mode to show conflicts without calling the slow availability API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    
    if (!date) {
      return NextResponse.json({ error: 'date parameter is required' }, { status: 400 })
    }
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 })
    }
    
    // Fetch bookings for the specific date (only pending and confirmed matter for conflicts)
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_time,
        duration_minutes,
        status,
        customers (
          name
        )
      `)
      .eq('booking_date', date)
      .in('status', ['pending', 'confirmed'])
      .order('booking_time', { ascending: true })

    if (error) {
      console.error('Error fetching bookings by date:', error)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    return NextResponse.json({ bookings: bookings || [] })

  } catch (error) {
    console.error('Bookings by date API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
