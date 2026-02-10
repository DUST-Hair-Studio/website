import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveSegmentCount } from '@/lib/segment-resolver'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: segments, error } = await supabase
      .from('segments')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching segments:', error)
      return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 })
    }

    // Resolve contact counts for each segment
    const segmentsWithCount = await Promise.all(
      (segments || []).map(async (seg) => {
        const count = await resolveSegmentCount(supabase, seg)
        return { ...seg, contactCount: count }
      })
    )

    return NextResponse.json({ segments: segmentsWithCount })
  } catch (err) {
    console.error('Segments API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, rules, emails } = body

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }
    if (!['rule_based', 'manual'].includes(type)) {
      return NextResponse.json({ error: 'Type must be rule_based or manual' }, { status: 400 })
    }

    const insert: Record<string, unknown> = {
      name: String(name).trim(),
      type,
      updated_at: new Date().toISOString()
    }

    if (type === 'rule_based') {
      if (!rules || typeof rules !== 'object') {
        return NextResponse.json({ error: 'Rules required for rule_based segment' }, { status: 400 })
      }
      const customerType = rules.customerType ?? 'all'
      if (!['all', 'loyalty', 'new'].includes(customerType)) {
        return NextResponse.json({ error: 'rules.customerType must be all, loyalty, or new' }, { status: 400 })
      }
      const normalizedRules: Record<string, unknown> = { customerType }
      if (rules.lastBookedWithinDays != null) {
        const n = Number(rules.lastBookedWithinDays)
        if (n < 1 || n > 3650) {
          return NextResponse.json({ error: 'lastBookedWithinDays must be between 1 and 3650' }, { status: 400 })
        }
        normalizedRules.lastBookedWithinDays = Math.floor(n)
      }
      if (rules.hasNeverBooked != null) normalizedRules.hasNeverBooked = !!rules.hasNeverBooked
      if (rules.hasEmail != null) normalizedRules.hasEmail = !!rules.hasEmail
      insert.rules = normalizedRules
      insert.emails = null
    } else {
      if (!Array.isArray(emails)) {
        return NextResponse.json({ error: 'Emails array required for manual segment' }, { status: 400 })
      }
      const normalized = [...new Set(
        emails
          .map((e: string) => String(e).trim().toLowerCase())
          .filter((e: string) => e && e.includes('@'))
      )]
      insert.emails = normalized
      insert.rules = null
    }

    const { data, error } = await supabase
      .from('segments')
      .insert(insert)
      .select()
      .single()

    if (error) {
      console.error('Error creating segment:', error)
      return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 })
    }

    const count = await resolveSegmentCount(supabase, data)
    return NextResponse.json({ segment: { ...data, contactCount: count } })
  } catch (err) {
    console.error('Segments API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

