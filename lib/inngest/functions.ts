import { inngest } from './client'
import { executeCampaignBroadcast } from '@/lib/campaign-broadcast'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export const sendCampaignBroadcast = inngest.createFunction(
  {
    id: 'send-campaign-broadcast',
    retries: 2,
    timeouts: { finish: '600s' }
  },
  { event: 'campaign/broadcast.send' },
  async ({ event }) => {
    const { jobId } = event.data
    const supabase = createAdminSupabaseClient()

    const { data: job, error: fetchErr } = await supabase
      .from('campaign_send_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (fetchErr || !job || job.status !== 'pending') {
      console.error('Campaign send job not found or not pending:', jobId, fetchErr)
      return { error: 'Job not found' }
    }

    await supabase
      .from('campaign_send_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', jobId)

    const emailList = (job.email_list ?? []) as string[]
    const normalizedEmails = [...new Set(
      emailList.map((e: string) => String(e).trim().toLowerCase()).filter((e: string) => e && e.includes('@'))
    )]

    const result = await executeCampaignBroadcast({
      normalizedEmails,
      subject: job.subject,
      message: job.message ?? '',
      campaignName: job.campaign_id,
      registrationUrl: job.registration_url ?? undefined,
      buttonText: job.button_text ?? undefined,
      sentBy: job.sent_by
    })

    if (result.success) {
      await supabase
        .from('campaign_send_jobs')
        .update({
          status: 'completed',
          result: { total: result.total, successful: result.total, failed: 0, broadcastId: result.broadcastId },
          error_message: null,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
      return result
    }

    await supabase
      .from('campaign_send_jobs')
      .update({
        status: 'failed',
        error_message: result.details ? `${result.error}: ${result.details}` : result.error,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
    throw new Error(result.error)
  }
)
