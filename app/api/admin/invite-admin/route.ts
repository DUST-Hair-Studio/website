import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { email, name } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

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

    // Check if email is already an admin
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (existingAdmin) {
      return NextResponse.json({ error: 'This email is already an admin' }, { status: 400 })
    }

    const adminSupabase = createAdminSupabaseClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const normalizedEmail = email.toLowerCase().trim()

    // Invite user via Supabase Auth - creates auth user and sends invite email
    const { data: authData, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo: `${appUrl}/admin`,
        data: { name: name || email.split('@')[0] }
      }
    )

    if (inviteError) {
      console.error('Invite admin error:', JSON.stringify(inviteError, null, 2))
      const isUserExists =
        inviteError.message?.toLowerCase().includes('already been registered') ||
        inviteError.message?.toLowerCase().includes('already exists') ||
        inviteError.message?.toLowerCase().includes('user_already_exists') ||
        inviteError.message?.toLowerCase().includes('email_exists')

      if (isUserExists) {
        // User exists in Auth - try to add them as admin (they may have been a customer)
        const { data: usersData } = await adminSupabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        })

        const authUser = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === normalizedEmail
        )

        if (authUser) {
          // Add to admin_users - they can log in with existing password or use forgot password
          const now = new Date().toISOString()
          const { error: insertError } = await adminSupabase
            .from('admin_users')
            .insert({
              email: normalizedEmail,
              password_hash: 'supabase_auth_user',
              name: (name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || normalizedEmail.split('@')[0]).trim(),
              role: 'admin',
              is_active: true,
              created_at: now,
              updated_at: now
            })

          if (insertError) {
            // May fail if already in admin_users (race condition)
            if (insertError.code === '23505') {
              return NextResponse.json(
                { error: 'This email is already an admin.' },
                { status: 400 }
              )
            }
            console.error('Insert admin_users error:', insertError)
            const errorDetail = insertError.message || insertError.code || 'Unknown database error'
            return NextResponse.json(
              { error: `Failed to add as admin: ${errorDetail}` },
              { status: 500 }
            )
          }

          return NextResponse.json({
            success: true,
            message: 'User was already registered. They have been added as admin. They can log in at /admin/login with their existing password, or use "Forgot password" if needed.'
          })
        }
      }

      return NextResponse.json(
        { error: inviteError.message || 'Failed to send invite', details: inviteError.status || inviteError.code },
        { status: 500 }
      )
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    // Insert into admin_users - designate them as admin
    const now = new Date().toISOString()
    const { error: insertError } = await adminSupabase
      .from('admin_users')
      .insert({
        email: normalizedEmail,
        password_hash: 'supabase_auth_user',
        name: (name || email.split('@')[0]).trim(),
        role: 'admin',
        is_active: true,
        created_at: now,
        updated_at: now
      })

    if (insertError) {
      console.error('Insert admin_users error:', insertError)
      const errorDetail = insertError.message || insertError.code || 'Unknown database error'
      return NextResponse.json(
        { error: `Invite sent but failed to add admin record: ${errorDetail}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invite sent successfully. The user will receive an email to set their password and access the admin portal.'
    })
  } catch (error) {
    console.error('Invite admin API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
