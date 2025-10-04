import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Auto-confirm the email
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 })
    }

    // Update admin_users table with the auth user ID
    const { error: adminError } = await supabase
      .from('admin_users')
      .update({ auth_user_id: authData.user.id })
      .eq('email', email)

    if (adminError) {
      console.error('Error updating admin_users:', adminError)
      return NextResponse.json({ error: 'Failed to update admin users table' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Admin user created successfully',
      user: { id: authData.user.id, email: authData.user.email }
    })

  } catch (error) {
    console.error('Create admin user API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
