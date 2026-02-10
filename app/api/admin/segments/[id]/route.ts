import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveSegmentCount } from '@/lib/segment-resolver'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('segments')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    const count = await resolveSegmentCount(supabase, data)
    return NextResponse.json({ segment: { ...data, contactCount: count } })
  } catch (err) {
    console.error('Segment API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, rules, emails } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = String(name).trim()
    if (rules !== undefined) {
      const r = rules as Record<string, unknown>
      const customerType = r?.customerType ?? 'all'
      if (!['all', 'loyalty', 'new'].includes(String(customerType))) {
        return NextResponse.json({ error: 'rules.customerType must be all, loyalty, or new' }, { status: 400 })
      }
      const normalizedRules: Record<string, unknown> = { customerType }
      if (r.lastBookedWithinDays != null) {
        const n = Number(r.lastBookedWithinDays)
        if (n < 1 || n > 3650) {
          return NextResponse.json({ error: 'lastBookedWithinDays must be between 1 and 3650' }, { status: 400 })
        }
        normalizedRules.lastBookedWithinDays = Math.floor(n)
      }
      if (r.hasNeverBooked != null) normalizedRules.hasNeverBooked = !!r.hasNeverBooked
      if (r.hasEmail != null) normalizedRules.hasEmail = !!r.hasEmail
      updates.rules = normalizedRules
    }
    if (emails !== undefined) {
      if (!Array.isArray(emails)) {
        return NextResponse.json({ error: 'Emails must be an array' }, { status: 400 })
      }
      updates.emails = [...new Set(
        emails.map((e: string) => String(e).trim().toLowerCase()).filter((e: string) => e && e.includes('@'))
      )]
    }

    const { data, error } = await supabase
      .from('segments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating segment:', error)
      return NextResponse.json({ error: 'Failed to update segment' }, { status: 500 })
    }

    const count = await resolveSegmentCount(supabase, data)
    return NextResponse.json({ segment: { ...data, contactCount: count } })
  } catch (err) {
    console.error('Segment API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase.from('segments').delete().eq('id', id)
    if (error) {
      console.error('Error deleting segment:', error)
      return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Segment API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

