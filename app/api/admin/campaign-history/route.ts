import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build query
    let query = supabase
      .from('campaign_send_history')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(limit)

    // Filter by campaign if specified
    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    const { data: history, error: historyError } = await query

    if (historyError) {
      console.error('Error fetching campaign history:', historyError)
      return NextResponse.json({ error: 'Failed to fetch campaign history' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      history: history || []
    })

  } catch (error) {
    console.error('Campaign history API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
