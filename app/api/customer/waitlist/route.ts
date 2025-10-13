import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin client for database operations (bypasses RLS)
    const adminSupabase = createAdminSupabaseClient()

    // Get customer_id from auth user
    const { data: customer, error: customerError } = await adminSupabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Get waitlist requests for this customer
    const { data: waitlistRequests, error: waitlistError } = await adminSupabase
      .from('waitlist_requests')
      .select(`
        *,
        services (
          name,
          description,
          duration_minutes
        )
      `)
      .eq('customer_id', customer.id)
      .in('status', ['pending', 'notified'])
      .order('created_at', { ascending: false })

    if (waitlistError) {
      console.error('Error fetching waitlist requests:', waitlistError)
      return NextResponse.json(
        { error: 'Failed to fetch waitlist requests' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      waitlist: waitlistRequests || []
    })

  } catch (error) {
    console.error('Error in GET /api/customer/waitlist:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

