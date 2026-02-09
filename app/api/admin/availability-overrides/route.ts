import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET list availability overrides (optional startDate, endDate query params)
export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') ?? searchParams.get('start_date')
    const endDate = searchParams.get('endDate') ?? searchParams.get('end_date')

    let query = supabase
      .from('availability_overrides')
      .select('id, date, open_time, close_time, created_at')
      .order('date', { ascending: true })

    if (startDate) {
      query = query.gte('date', startDate)
    }
    if (endDate) {
      query = query.lte('date', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching availability overrides:', error)
      return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 })
    }

    return NextResponse.json({ overrides: data ?? [] })
  } catch (error) {
    console.error('Availability overrides GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST add a one-time open date
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    const { date, open_time, close_time } = body

    if (!date || typeof date !== 'string') {
      return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
    }

    const openTime = open_time ?? '11:00'
    const closeTime = close_time ?? '21:00'

    const { data, error } = await supabase
      .from('availability_overrides')
      .upsert(
        { date, open_time: openTime, close_time: closeTime },
        { onConflict: 'date' }
      )
      .select('id, date, open_time, close_time, created_at')
      .single()

    if (error) {
      console.error('Error creating availability override:', error)
      return NextResponse.json({ error: error.message || 'Failed to create override' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Availability overrides POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
