import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Verify this email belongs to an active admin before sending a reset.
    // We always respond with success to avoid revealing which emails are admins.
    const adminSupabase = createAdminSupabaseClient()
    const { data: admin } = await adminSupabase
      .from('admin_users')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .maybeSingle()

    if (admin) {
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
      const redirectTo = `${baseUrl}/admin/accept-invite`

      const publicSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )

      const { error: resetError } = await publicSupabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo }
      )

      if (resetError) {
        console.error('Admin password reset error:', resetError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
