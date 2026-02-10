import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { inngest } from '@/lib/inngest/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { emailList, subject, message, campaignName, registrationUrl, buttonText } = await request.json()

    if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
      return NextResponse.json({ error: 'Email list is required' }, { status: 400 })
    }

    const normalizedEmails = [...new Set(
      emailList.map((e: string) => String(e).trim().toLowerCase()).filter((e: string) => e && e.includes('@'))
    )]
    if (normalizedEmails.length === 0) {
      return NextResponse.json({ error: 'No valid email addresses' }, { status: 400 })
    }

    const adminSupabase = createAdminSupabaseClient()

    const { data: job, error: insertErr } = await adminSupabase
      .from('campaign_send_jobs')
      .insert({
        status: 'pending',
        sent_by: user.id,
        campaign_id: campaignName || 'unknown',
        campaign_name: campaignName || 'Unknown Campaign',
        subject,
        message: message ?? '',
        registration_url: registrationUrl ?? null,
        button_text: buttonText ?? null,
        email_list: normalizedEmails
      })
      .select('id')
      .single()

    if (insertErr || !job?.id) {
      console.error('Failed to create campaign send job:', insertErr)
      return NextResponse.json({
        error: 'Failed to queue campaign send',
        details: insertErr?.message
      }, { status: 500 })
    }

    await inngest.send({
      name: 'campaign/broadcast.send',
      data: { jobId: job.id }
    })

    return NextResponse.json(
      {
        accepted: true,
        jobId: job.id,
        message: `Campaign queued. Sending to ${normalizedEmails.length} recipients in the background.`
      },
      { status: 202 }
    )
  } catch (error) {
    console.error('Send campaign broadcast error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
