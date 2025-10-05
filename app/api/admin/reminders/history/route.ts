import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET reminder history
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const { data: history, error } = await supabase
      .from('reminder_history')
      .select(`
        *,
        bookings!inner(
          id,
          customer_id,
          booking_date,
          booking_time,
          customers!inner(
            name,
            email
          )
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching reminder history:', error)
      // If table doesn't exist, return empty array
      if (error.code === 'PGRST116' || error.message?.includes('relation "reminder_history" does not exist')) {
        return NextResponse.json({ history: [] })
      }
      return NextResponse.json({ error: 'Failed to fetch history', details: error.message }, { status: 500 })
    }

    // Transform the data to match our interface
    const transformedHistory = history.map(item => ({
      id: item.id,
      booking_id: item.booking_id,
      customer_name: item.bookings?.customers?.name || 'Unknown',
      customer_email: item.bookings?.customers?.email || 'Unknown',
      template_id: item.template_id,
      template_name: item.template_name,
      status: item.status,
      scheduled_for: item.scheduled_for,
      sent_at: item.sent_at,
      error_message: item.error_message,
      created_at: item.created_at
    }))

    return NextResponse.json({ history: transformedHistory })
  } catch (error) {
    console.error('Reminder history API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
