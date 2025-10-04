import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (authError) {
      console.error('Admin login auth error:', authError)
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Check if user exists in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      console.error('Admin user not found:', adminError)
      return NextResponse.json({ error: 'Admin access denied' }, { status: 403 })
    }

    // Update last login
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminUser.id)

    return NextResponse.json({ 
      success: true,
      user: authData.user,
      admin: adminUser
    })

  } catch (error) {
    console.error('Admin login API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
