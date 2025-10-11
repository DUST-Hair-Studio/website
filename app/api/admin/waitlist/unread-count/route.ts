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

    // Get last viewed timestamp from settings
    const { data: lastViewedData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'waitlist_last_viewed_at')
      .single()

    let lastViewedAt = lastViewedData?.value
    // If it's a JSON string, parse it
    if (lastViewedAt && typeof lastViewedAt === 'string' && lastViewedAt.startsWith('"')) {
      try {
        lastViewedAt = JSON.parse(lastViewedAt)
      } catch (e) {
        console.error('🔔 [UNREAD COUNT API] Error parsing last viewed timestamp:', e)
        lastViewedAt = null
      }
    }
    console.log('🔔 [UNREAD COUNT API] Last viewed at:', lastViewedAt)

    // Use admin client to count unread waitlist requests
    const adminSupabase = createAdminSupabaseClient()

    let query = adminSupabase
      .from('waitlist_requests')
      .select('id', { count: 'exact', head: true })

    // If there's a last viewed timestamp, count only items created after it
    if (lastViewedAt) {
      query = query.gt('created_at', lastViewedAt)
    }

    const { count, error: countError } = await query

    if (countError) {
      console.error('🔔 [UNREAD COUNT API] Error counting unread waitlist requests:', countError)
      return NextResponse.json(
        { error: 'Failed to count unread waitlist requests' },
        { status: 500 }
      )
    }

    console.log('🔔 [UNREAD COUNT API] Unread count:', count)
    
    return NextResponse.json({
      unreadCount: count || 0,
      lastViewedAt: lastViewedAt || null
    })

  } catch (error) {
    console.error('Error in GET /api/admin/waitlist/unread-count:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

