import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET all reminder templates
export async function GET() {
  try {
    const supabase = createAdminSupabaseClient()
    
    const { data: templates, error } = await supabase
      .from('reminder_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching reminder templates:', error)
      // If table doesn't exist, return empty array
      if (error.code === 'PGRST116' || error.message?.includes('relation "reminder_templates" does not exist')) {
        return NextResponse.json({ templates: [] })
      }
      return NextResponse.json({ error: 'Failed to fetch templates', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Reminder templates API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create new reminder template
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { name, type, subject, message, hours_before, is_active } = body

    if (!name || !type || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: template, error } = await supabase
      .from('reminder_templates')
      .insert({
        name,
        type,
        subject,
        message,
        hours_before: hours_before || 24,
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating reminder template:', error)
      // If table doesn't exist, provide helpful error message
      if (error.code === 'PGRST116' || error.message?.includes('relation "reminder_templates" does not exist')) {
        return NextResponse.json({ 
          error: 'Database tables not set up. Please run the reminder system migration first.',
          details: 'The reminder_templates table does not exist. Run the SQL migration in database-migrations/reminder-system.sql'
        }, { status: 500 })
      }
      return NextResponse.json({ error: 'Failed to create template', details: error.message }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Reminder templates API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
