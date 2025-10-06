import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('🔍 Customer Bookings API - User:', user?.email, user?.id)
    
    if (authError || !user) {
      console.log('❌ Customer Bookings API - Not authenticated:', authError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Find the customer record
    let customer = null
    
    // First try: auth_user_id
    const { data: customerByAuthId, error: errorByAuthId } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    
    if (customerByAuthId && !errorByAuthId) {
      customer = customerByAuthId
      console.log('🔍 Customer Bookings API - Found customer by auth_user_id:', customer.id)
    } else {
      console.log('🔍 Customer Bookings API - No customer found by auth_user_id, trying email...')
      // Second try: email (fallback)
      const { data: customerByEmail, error: errorByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', user.email)
        .single()
      
      if (customerByEmail && !errorByEmail) {
        customer = customerByEmail
        console.log('🔍 Customer Bookings API - Found customer by email:', customer.id)
      } else {
        console.log('❌ Customer Bookings API - Customer not found:', errorByEmail)
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
    }

    // Fetch all bookings for this customer
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        *,
        services (
          name,
          description,
          duration_minutes
        ),
        customers (
          name,
          email,
          phone
        )
      `)
      .eq('customer_id', customer.id)
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false })

    if (bookingsError) {
      console.error('❌ Error fetching customer bookings:', bookingsError)
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
    }

    console.log('🔍 Customer Bookings API - Found bookings:', bookings?.length || 0)

    return NextResponse.json({ 
      bookings: bookings || [],
      customer: {
        id: customer.id,
        email: user.email
      }
    })

  } catch (error) {
    console.error('Customer bookings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
