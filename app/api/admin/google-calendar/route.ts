import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET Google Calendar integration status
export async function GET() {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .in('key', ['google_calendar_connected', 'google_calendar_id', 'google_access_token'])

    if (error) {
      console.error('Error fetching Google Calendar settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, unknown>)

    const isConnected = Boolean(settingsMap.google_calendar_connected)
    const calendarId = settingsMap.google_calendar_id
    const hasToken = Boolean(settingsMap.google_access_token)

    return NextResponse.json({
      isConnected,
      calendarId,
      hasToken,
      authUrl: isConnected ? null : generateGoogleAuthUrl()
    })
  } catch (error) {
    console.error('Google Calendar API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST Google Calendar OAuth callback
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json({ error: 'Authorization code is required' }, { status: 400 })
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/schedule`
      })
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('Google OAuth error:', tokenData)
      return NextResponse.json({ error: 'Failed to get access token' }, { status: 500 })
    }

    // Get user's calendar list to find primary calendar
    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      }
    })

    const calendarData = await calendarResponse.json()
    const primaryCalendar = calendarData.items?.find((cal: { primary?: boolean }) => cal.primary)

    if (!primaryCalendar) {
      return NextResponse.json({ error: 'Could not find primary calendar' }, { status: 500 })
    }

    // Store settings in database
    const settingsToUpdate = [
      { key: 'google_calendar_connected', value: true },
      { key: 'google_calendar_id', value: primaryCalendar.id },
      { key: 'google_access_token', value: tokenData.access_token },
      { key: 'google_refresh_token', value: tokenData.refresh_token },
      { key: 'google_token_expires_at', value: Date.now() + (tokenData.expires_in * 1000) }
    ]

    for (const setting of settingsToUpdate) {
      await supabase
        .from('settings')
        .upsert({ key: setting.key, value: setting.value, updated_at: new Date().toISOString() })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Google Calendar connected successfully',
      calendarId: primaryCalendar.id
    })
  } catch (error) {
    console.error('Google Calendar OAuth callback error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE Google Calendar connection
export async function DELETE() {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Remove Google Calendar settings
    const settingsToRemove = [
      'google_calendar_connected',
      'google_calendar_id',
      'google_access_token',
      'google_refresh_token',
      'google_token_expires_at'
    ]

    for (const key of settingsToRemove) {
      await supabase
        .from('settings')
        .delete()
        .eq('key', key)
    }

    return NextResponse.json({ success: true, message: 'Google Calendar disconnected' })
  } catch (error) {
    console.error('Google Calendar disconnect error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/schedule`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent'
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}
