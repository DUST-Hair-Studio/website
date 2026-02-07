import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    // Verify current user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: currentAdmin, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', user.email)
      .eq('is_active', true)
      .single()

    if (adminError || !currentAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Use admin client to bypass RLS - we've verified the user is an admin
    const adminSupabase = createAdminSupabaseClient()
    const { data: admins, error } = await adminSupabase
      .from('admin_users')
      .select('id, email, name, is_active, last_login, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Fetch admins error:', error)
      return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
    }

    return NextResponse.json({ admins: admins || [] })
  } catch (error) {
    console.error('List admins API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
