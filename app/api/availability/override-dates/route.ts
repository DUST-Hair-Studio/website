import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

/**
 * Public list of dates that are open via one-time overrides (for calendar enabling).
 * Used by the booking flow so override dates are selectable in the calendar.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') ?? searchParams.get('start_date')
    const endDate = searchParams.get('endDate') ?? searchParams.get('end_date')

    let query = supabase
      .from('availability_overrides')
      .select('date')
      .order('date', { ascending: true })

    if (startDate) query = query.gte('date', startDate)
    if (endDate) query = query.lte('date', endDate)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching override dates:', error)
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
    }

    const dates = (data ?? []).map((row) => {
      const d = row.date
      if (typeof d === 'string') return d.slice(0, 10)
      if (d instanceof Date) return d.toISOString().slice(0, 10)
      return String(d)
    })

    return NextResponse.json({ dates })
  } catch (error) {
    console.error('Override dates API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
