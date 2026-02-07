import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params

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

    const body = await request.json()
    const { is_active } = body

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 })
    }

    // Prevent deactivating yourself
    const { data: targetAdmin } = await supabase
      .from('admin_users')
      .select('email')
      .eq('id', id)
      .single()

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    if (targetAdmin.email?.toLowerCase() === user.email?.toLowerCase() && !is_active) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminSupabaseClient()
    const { data: updated, error } = await adminSupabase
      .from('admin_users')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, email, name, is_active, last_login, created_at')
      .single()

    if (error) {
      console.error('Update admin error:', error)
      return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
    }

    return NextResponse.json({ admin: updated })
  } catch (error) {
    console.error('Admin update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params

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

    const { data: targetAdmin } = await supabase
      .from('admin_users')
      .select('email')
      .eq('id', id)
      .single()

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    if (targetAdmin.email?.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'You cannot remove your own account' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminSupabaseClient()
    const { error } = await adminSupabase
      .from('admin_users')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete admin error:', error)
      return NextResponse.json({ error: 'Failed to remove admin' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin delete API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
