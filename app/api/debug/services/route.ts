import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get all services
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .order('sort_order', { ascending: true })

    if (servicesError) {
      console.error('Error fetching services:', servicesError)
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
    }

    // Get all bookings for each service
    const servicesWithBookings = await Promise.all(
      services.map(async (service) => {
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('id, booking_date, booking_time')
          .eq('service_id', service.id)

        return {
          ...service,
          bookings: bookings || [],
          bookingsError: bookingsError?.message || null
        }
      })
    )

    return NextResponse.json({ 
      services: servicesWithBookings,
      total_services: services.length 
    })
  } catch (error) {
    console.error('Debug services API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
