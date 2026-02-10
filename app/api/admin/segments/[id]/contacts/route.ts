import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveSegmentEmails } from '@/lib/segment-resolver'

/** Resolve segment to list of email addresses. */
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

    const { data: seg, error } = await supabase
      .from('segments')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !seg) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 })
    }

    const emails = seg.type === 'manual'
      ? (seg.emails || [])
      : await resolveSegmentEmails(supabase, seg.rules)

    return NextResponse.json({ emails, count: emails.length })
  } catch (err) {
    console.error('Segment contacts API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
