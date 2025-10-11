import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET all customers with booking stats
export async function GET() {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Fetch all customers with their booking counts and latest booking info
    const { data: customers, error } = await supabase
      .from('customers')
      .select(`
        *,
        bookings (
          id,
          booking_date,
          booking_time,
          status,
          price_charged,
          services (
            name
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching customers:', error)
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 })
    }

    // Process the data to include booking stats
    const processedCustomers = customers.map(customer => {
      const bookings = customer.bookings || []
      const totalBookings = bookings.length
      const lastBooking = bookings.length > 0 
        ? bookings.sort((a: { booking_date: string }, b: { booking_date: string }) => new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime())[0]
        : null
      return {
        ...customer,
        total_bookings: totalBookings,
        last_booking_date: lastBooking?.booking_date || null,
        last_booking_price: lastBooking?.price_charged || null,
        total_spent: customer.total_spent || 0, // Use database field, fallback to 0
        bookings: undefined // Remove the raw bookings data to keep response clean
      }
    })

    return NextResponse.json({ customers: processedCustomers })
  } catch (error) {
    console.error('Admin customers API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH bulk update customer types
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { customerIds, is_existing_customer } = body

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: 'customerIds array is required' }, { status: 400 })
    }

    if (typeof is_existing_customer !== 'boolean') {
      return NextResponse.json({ error: 'is_existing_customer must be a boolean' }, { status: 400 })
    }

    // Update multiple customers
    const { data: customers, error } = await supabase
      .from('customers')
      .update({
        is_existing_customer,
        updated_at: new Date().toISOString()
      })
      .in('id', customerIds)
      .select('*')

    if (error) {
      console.error('Error bulk updating customers:', error)
      return NextResponse.json({ error: 'Failed to update customers' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: `Successfully updated ${customers.length} customers`,
      customers 
    })
  } catch (error) {
    console.error('Admin bulk customer update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
