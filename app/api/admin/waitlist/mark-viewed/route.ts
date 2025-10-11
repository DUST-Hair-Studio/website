import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
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
    console.log('🔔 [MARK VIEWED API] Checking admin status for user:', user.email)
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      console.error('🔔 [MARK VIEWED API] Admin check failed:', adminError)
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }
    
    console.log('🔔 [MARK VIEWED API] Admin access confirmed for:', user.email)

    // Update the last viewed timestamp in settings using admin client (bypasses RLS)
    const adminSupabase = createAdminSupabaseClient()
    const now = new Date().toISOString()
    console.log('🔔 [MARK VIEWED API] Setting last viewed timestamp to:', now)
    
    const upsertData = {
      key: 'waitlist_last_viewed_at',
      value: `"${now}"`, // Wrap in quotes to make it a JSON string
      description: 'Timestamp when admin last viewed the waitlist page'
    }
    console.log('🔔 [MARK VIEWED API] Upsert data:', JSON.stringify(upsertData, null, 2))
    
    const { error: updateError } = await adminSupabase
      .from('settings')
      .upsert(upsertData, {
        onConflict: 'key'
      })

    if (updateError) {
      console.error('🔔 [MARK VIEWED API] Error updating waitlist last viewed timestamp:', updateError)
      console.error('🔔 [MARK VIEWED API] Full error details:', JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        { error: 'Failed to update last viewed timestamp', details: updateError },
        { status: 500 }
      )
    }

    console.log('🔔 [MARK VIEWED API] Successfully updated timestamp')
    
    return NextResponse.json({
      success: true,
      lastViewedAt: now
    })

  } catch (error) {
    console.error('Error in POST /api/admin/waitlist/mark-viewed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

