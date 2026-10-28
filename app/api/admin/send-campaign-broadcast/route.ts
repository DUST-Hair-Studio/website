import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { executeCampaignBroadcast } from '@/lib/campaign-broadcast'

// Allow headroom for larger recipient lists (batch send runs in-request).
export const maxDuration = 300

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

    // Send synchronously. The batch mechanism (Resend batch.send, 50 at a time)
    // is fast enough that no background queue is needed.
    const result = await executeCampaignBroadcast({
      normalizedEmails,
      subject,
      message: message ?? '',
      campaignName: campaignName ?? 'campaign',
      registrationUrl: registrationUrl ?? undefined,
      buttonText: buttonText ?? undefined,
      sentBy: user.id
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      )
    }

    return NextResponse.json({
      results: {
        total: result.total,
        successful: result.successful,
        failed: result.failed,
        details: result.details
      },
      message: `Campaign sent to ${result.successful} of ${result.total} recipients`
    })
  } catch (error) {
    console.error('Send campaign broadcast error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
