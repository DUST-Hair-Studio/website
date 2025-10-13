import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check authentication and admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify admin status
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Get status filter from query parameters
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Use admin client to fetch waitlist requests
    const adminSupabase = createAdminSupabaseClient()

    let query = adminSupabase
      .from('waitlist_requests')
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

    // Apply status filter if provided
    if (statusFilter) {
      const statuses = statusFilter.split(',')
      query = query.in('status', statuses)
    }

    const { data: waitlistRequests, error: waitlistError } = await query
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
    console.error('Error in GET /api/admin/waitlist:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

