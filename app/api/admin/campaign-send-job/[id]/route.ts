import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    const adminSupabase = createAdminSupabaseClient()
    const { data: job, error } = await adminSupabase
      .from('campaign_send_jobs')
      .select('id, status, campaign_id, campaign_name, subject, result, error_message, created_at, completed_at')
      .eq('id', id)
      .eq('sent_by', user.id)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      campaignId: job.campaign_id,
      campaignName: job.campaign_name,
      subject: job.subject,
      result: job.result,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      completedAt: job.completed_at
    })
  } catch (error) {
    console.error('Get campaign send job error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
