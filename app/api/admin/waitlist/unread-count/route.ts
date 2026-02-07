import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    console.log('🔔 [UNREAD COUNT API] Starting request...')
    
    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('🔔 [UNREAD COUNT API] SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json(
        { error: 'Server configuration error', unreadCount: 0 },
        { status: 200 }
      )
    }
    
    const supabase = await createServerSupabaseClient()
    console.log('🔔 [UNREAD COUNT API] Created server client')
    
    // Check authentication and admin access
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      console.error('🔔 [UNREAD COUNT API] Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized', unreadCount: 0 },
        { status: 401 }
      )
    }
    
    if (!user) {
      console.log('🔔 [UNREAD COUNT API] No user found')
      return NextResponse.json(
        { error: 'Unauthorized', unreadCount: 0 },
        { status: 401 }
      )
    }
    
    console.log('🔔 [UNREAD COUNT API] User authenticated:', user.email)

    // Verify admin status
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)
      .single()

    if (adminError) {
      console.error('🔔 [UNREAD COUNT API] Admin check error:', adminError)
      return NextResponse.json(
        { error: 'Forbidden - Admin access required', unreadCount: 0 },
        { status: 403 }
      )
    }
    
    if (!adminUser) {
      console.log('🔔 [UNREAD COUNT API] User is not an admin:', user.email)
      return NextResponse.json(
        { error: 'Forbidden - Admin access required', unreadCount: 0 },
        { status: 403 }
      )
    }
    
    console.log('🔔 [UNREAD COUNT API] Admin verified')

    // Get last viewed timestamp from settings (maybeSingle handles 0 rows without error)
    const { data: lastViewedData, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'waitlist_last_viewed_at')
      .maybeSingle()
    
    if (settingsError) {
      console.error('🔔 [UNREAD COUNT API] Settings query error:', settingsError)
    }

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
    console.log('🔔 [UNREAD COUNT API] Created admin client')

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
        { error: 'Failed to count unread waitlist requests', unreadCount: 0 },
        { status: 200 }
      )
    }

    console.log('🔔 [UNREAD COUNT API] Unread count:', count)
    
    return NextResponse.json({
      unreadCount: count || 0,
      lastViewedAt: lastViewedAt || null
    })

  } catch (error) {
    console.error('🔔 [UNREAD COUNT API] Unexpected error:', error)
    console.error('🔔 [UNREAD COUNT API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('🔔 [UNREAD COUNT API] Error name:', error instanceof Error ? error.name : 'Unknown')
    console.error('🔔 [UNREAD COUNT API] Error message:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error', 
        unreadCount: 0,
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

