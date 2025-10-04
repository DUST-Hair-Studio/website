import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Fetch all bookings with customer and service details
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        services (
          name,
          description,
          duration_minutes
        ),
        customers (
          first_name,
          last_name,
          email,
          phone,
          is_existing_customer
        )
      `)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true })

    if (error) {
      console.error('Error fetching bookings:', error)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    return NextResponse.json({ bookings })

  } catch (error) {
    console.error('Admin bookings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
