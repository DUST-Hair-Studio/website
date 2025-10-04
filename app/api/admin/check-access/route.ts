import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ isAdmin: false }, { status: 401 })
    }

    // Check if user exists in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)
      .single()

    if (adminError || !adminUser) {
      return NextResponse.json({ isAdmin: false }, { status: 403 })
    }

    return NextResponse.json({ 
      isAdmin: true,
      admin: adminUser
    })

  } catch (error) {
    console.error('Admin check access API error:', error)
    return NextResponse.json({ isAdmin: false }, { status: 500 })
  }
}
