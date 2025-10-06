import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET all settings
export async function GET() {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: settings, error } = await supabase
      .from('settings')
      .select('*')
      .order('key')

    if (error) {
      console.error('Error fetching settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    // Organize settings by category
    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, unknown>)

    const business = {
      business_name: settingsMap.business_name || '',
      business_phone: settingsMap.business_phone || '',
      business_email: settingsMap.business_email || '',
      business_address: settingsMap.business_address || '',
      timezone: settingsMap.business_timezone || 'America/Los_Angeles'
    }

    const notifications = {
      email_enabled: settingsMap.email_enabled || true,
      confirmation_message: settingsMap.confirmation_message || 'Your appointment is confirmed for {date} at {time}. We look forward to seeing you!',
      reminder_message: settingsMap.reminder_message || 'Reminder: You have an appointment tomorrow at {time}. See you soon!'
    }

    const payments = {
      square_enabled: settingsMap.square_enabled || false,
      square_application_id: settingsMap.square_application_id || '',
      square_access_token: settingsMap.square_access_token || '',
      payment_required: settingsMap.payment_required || false
    }

    const schedule = {
      buffer_time_minutes: settingsMap.buffer_time_minutes || 0
    }

    return NextResponse.json({
      business,
      notifications,
      payments,
      schedule
    })
  } catch (error) {
    console.error('Admin settings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST/PUT settings
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    
    // Handle both old format { type, settings } and new format { business, schedule, etc. }
    const { type, settings, business, schedule, payments, notifications } = body

    if (!type && !business && !schedule && !payments && !notifications) {
      return NextResponse.json({ error: 'Settings data is required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updates: Array<{ key: string; value: unknown; updated_at: string }> = []

    if (type === 'business') {
      if (settings.business_name !== undefined) {
        updates.push({ key: 'business_name', value: settings.business_name, updated_at: now })
      }
      if (settings.business_phone !== undefined) {
        updates.push({ key: 'business_phone', value: settings.business_phone, updated_at: now })
      }
      if (settings.business_email !== undefined) {
        updates.push({ key: 'business_email', value: settings.business_email, updated_at: now })
      }
      if (settings.business_address !== undefined) {
        updates.push({ key: 'business_address', value: settings.business_address, updated_at: now })
      }
      if (settings.timezone !== undefined) {
        updates.push({ key: 'business_timezone', value: settings.timezone, updated_at: now })
      }
    } else if (type === 'notifications') {
      if (settings.email_enabled !== undefined) {
        updates.push({ key: 'email_enabled', value: settings.email_enabled, updated_at: now })
      }
      if (settings.confirmation_message !== undefined) {
        updates.push({ key: 'confirmation_message', value: settings.confirmation_message, updated_at: now })
      }
      if (settings.reminder_message !== undefined) {
        updates.push({ key: 'reminder_message', value: settings.reminder_message, updated_at: now })
      }
    } else if (type === 'payments') {
      if (settings.square_enabled !== undefined) {
        updates.push({ key: 'square_enabled', value: settings.square_enabled, updated_at: now })
      }
      if (settings.square_application_id !== undefined) {
        updates.push({ key: 'square_application_id', value: settings.square_application_id, updated_at: now })
      }
      if (settings.square_access_token !== undefined) {
        updates.push({ key: 'square_access_token', value: settings.square_access_token, updated_at: now })
      }
      if (settings.payment_required !== undefined) {
        updates.push({ key: 'payment_required', value: settings.payment_required, updated_at: now })
      }
    } else if (type === 'schedule' || schedule) {
      const scheduleData = schedule || settings
      if (scheduleData.buffer_time_minutes !== undefined) {
        updates.push({ key: 'buffer_time_minutes', value: scheduleData.buffer_time_minutes, updated_at: now })
      }
    } else {
      return NextResponse.json({ error: 'Invalid settings type' }, { status: 400 })
    }

    // Update settings in batch
    const { error: updateError } = await supabase
      .from('settings')
      .upsert(updates, { onConflict: 'key' })

    if (updateError) {
      console.error('Error updating settings:', updateError)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin settings API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
