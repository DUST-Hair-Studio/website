import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get booking stats
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('status, price_charged')

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError)
      return NextResponse.json({ error: 'Failed to fetch booking stats' }, { status: 500 })
    }

    // Get customer stats
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('is_existing_customer')

    if (customersError) {
      console.error('Error fetching customers:', customersError)
      return NextResponse.json({ error: 'Failed to fetch customer stats' }, { status: 500 })
    }

    // Calculate stats
    const totalBookings = bookings.length
    const pendingBookings = bookings.filter(b => b.status === 'pending').length
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length
    const completedBookings = bookings.filter(b => b.status === 'completed').length
    
    const totalCustomers = customers.length
    const newCustomers = customers.filter(c => !c.is_existing_customer).length
    const existingCustomers = customers.filter(c => c.is_existing_customer).length
    
    const totalRevenue = bookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + (b.price_charged || 0), 0)

    const stats = {
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      totalCustomers,
      newCustomers,
      existingCustomers,
      totalRevenue
    }

    return NextResponse.json({ stats })

  } catch (error) {
    console.error('Admin dashboard API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
