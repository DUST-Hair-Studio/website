/**
 * Shared campaign broadcast logic - used by API (sync) and Inngest worker (async).
 */
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatCampaignMessage(message: string): string {
  const escaped = escapeHtml(message)
  const paragraphs = escaped.split(/\n\n+/)
  const formattedParagraphs = paragraphs.map((block) => {
    const lines = block.split('\n')
    const parts: string[] = []
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (line.startsWith('- ') || /^[•]\s/.test(line)) {
        const listItems: string[] = []
        while (i < lines.length && (lines[i].startsWith('- ') || /^[•]\s/.test(lines[i]))) {
          const item = lines[i].replace(/^[-•]\s*/, '')
          listItems.push(`<li>${item.replace(/__([^_]+)__/g, '<u>$1</u>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</li>`)
          i++
        }
        parts.push(`<ul class="campaign-list">${listItems.join('')}</ul>`)
        continue
      }
      const formatted = line.replace(/__([^_]+)__/g, '<u>$1</u>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      parts.push(formatted + (i < lines.length - 1 ? '<br>' : ''))
      i++
    }
    return parts.join('')
  })
  return formattedParagraphs.map((p) => `<p class="campaign-paragraph">${p}</p>`).join('')
}

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'div', 'span'])

function sanitizeCampaignHtml(html: string): string {
  let out = html
  out = out.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  out = out.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  out = out.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
  out = out.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''
    if (match.startsWith('</')) return `</${tag}>`
    if (tag === 'br') return '<br>'
    if (tag === 'a') {
      const hrefMatch = match.match(/href\s*=\s*["']([^"']*)["']/i)
      const href = hrefMatch ? hrefMatch[1] : '#'
      return `<a href="${href.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')}">`
    }
    return `<${tag}>`
  })
  return out
}

function renderMessageBody(message: string): string {
  if (typeof message !== 'string') return ''
  const trimmed = message.trim()
  if (!trimmed) return ''
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return sanitizeCampaignHtml(trimmed)
  return formatCampaignMessage(trimmed)
}

function toResendTemplate(
  text: string,
  opts: { businessName: string; campaignName: string; currentDate: string }
): string {
  return text
    .replace(/{email}/g, '{{{EMAIL}}}')
    .replace(/{customer_email}/g, '{{{EMAIL}}}')
    .replace(/{customer_name}/g, '{{{FIRST_NAME}}}')
    .replace(/{current_date}/g, opts.currentDate)
    .replace(/{campaign_id}/g, opts.campaignName)
    .replace(/{your_name}/g, opts.businessName)
    .replace(/{business_name}/g, opts.businessName)
}

export interface CampaignBroadcastInput {
  normalizedEmails: string[]
  subject: string
  message: string
  campaignName: string
  registrationUrl?: string
  buttonText?: string
  sentBy: string
}

export interface CampaignBroadcastResult {
  success: true
  total: number
  broadcastId: string
}

export interface CampaignBroadcastError {
  success: false
  error: string
  details?: string
}

export type CampaignBroadcastOutput = CampaignBroadcastResult | CampaignBroadcastError

export async function executeCampaignBroadcast(
  input: CampaignBroadcastInput
): Promise<CampaignBroadcastOutput> {
  if (!resend) {
    return { success: false, error: 'Email service not configured' }
  }

  const supabase = createAdminSupabaseClient()

  const { data: settings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['business_name', 'business_email', 'business_address'])

  const settingsMap = (settings || []).reduce((acc: Record<string, string>, s: { key: string; value: string }) => {
    acc[s.key] = s.value
    return acc
  }, {})

  const businessName = settingsMap.business_name || 'DUST Studio'
  const businessEmail = settingsMap.business_email || 'noreply@duststudio.com'
  const businessAddress = settingsMap.business_address || '1942 Riverside Dr, Los Angeles, CA 90039'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const finalRegistrationUrl = input.registrationUrl ? `${baseUrl}${input.registrationUrl}` : `${baseUrl}/register/existing`
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const subjectTemplate = toResendTemplate(input.subject, { businessName, campaignName: input.campaignName || '', currentDate })
  const messageTemplate = toResendTemplate(input.message, { businessName, campaignName: input.campaignName || '', currentDate })
  const htmlBody = renderMessageBody(messageTemplate)
  const finalButtonText = input.buttonText || ''

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subjectTemplate)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1C1C1D; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #FAFAFA; }
    .container { background: #FAFAFA; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #E5E5E5; }
    .logo { font-size: 32px; font-weight: bold; color: #1C1C1D; letter-spacing: 8px; text-transform: uppercase; }
    .content { background: #FFFFFF; padding: 40px; border: 1px solid #E5E5E5; }
    .message { font-size: 15px; color: #1C1C1D; margin-bottom: 30px; }
    .message .campaign-paragraph { margin: 0 0 1em 0; }
    .message .campaign-paragraph:last-child { margin-bottom: 0; }
    .message strong { font-weight: 700; }
    .message u { text-decoration: underline; }
    .message ul, .message .campaign-list { list-style: none; margin: 0.75em 0 1em 0; padding-left: 0; }
    .message ul li, .message .campaign-list li { margin-bottom: 0.35em; padding-left: 1.25em; position: relative; }
    .message ul li::before, .message .campaign-list li::before { content: "–"; font-weight: 700; position: absolute; left: 0; }
    .cta-container { text-align: center; margin: 35px 0; }
    .cta-button { display: inline-block; background: #1C1C1D; color: #FFFFFF !important; padding: 16px 40px; text-decoration: none; font-size: 14px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; border: none; }
    .cta-button:hover { background: #333; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E5E5; color: #666; font-size: 13px; }
    .footer-logo { font-size: 18px; font-weight: bold; color: #1C1C1D; letter-spacing: 4px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><div class="logo">DUST</div></div>
    <div class="content">
      <div class="message">${htmlBody}</div>
      ${finalButtonText && input.registrationUrl ? `
      <div class="cta-container">
        <a href="${finalRegistrationUrl}" class="cta-button" style="color: #FFFFFF !important; text-decoration: none;">${escapeHtml(finalButtonText)}</a>
      </div>
      ` : ''}
    </div>
    <div class="footer">
      <div class="footer-logo">DUST</div>
      <p>${escapeHtml(businessAddress)}</p>
      <p><a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p>
      <p>Questions? Reply to this email.</p>
    </div>
  </div>
</body>
</html>
`

  const REUSE_SEGMENT_NAME = 'DUST Campaign'
  let segmentId: string | null = (process.env.RESEND_CAMPAIGN_SEGMENT_ID?.trim() as string) || null

  if (!segmentId) {
    const { data: segments } = await resend.segments.list()
    const found = segments?.data?.find((s) => s.name === REUSE_SEGMENT_NAME)
    if (found?.id) segmentId = found.id
  }

  if (!segmentId) {
    const { data: created, error: createErr } = await resend.segments.create({ name: REUSE_SEGMENT_NAME })
    if (createErr || !created?.id) {
      const errMsg = createErr?.message || JSON.stringify(createErr)
      return {
        success: false,
        error: 'Failed to get campaign segment',
        details: errMsg
      }
    }
    segmentId = created.id
  }

  const delayMs = 600
  const delay = () => new Promise((r) => setTimeout(r, delayMs))

  const toRemove: string[] = []
  let after: string | undefined
  do {
    const { data: listData } = await resend.contacts.list({ segmentId, limit: 100, after })
    const contacts = listData?.data ?? []
    for (const c of contacts) {
      if (c.email) toRemove.push(c.email)
    }
    after = contacts.length === 100 && contacts[99]?.id ? contacts[99].id : undefined
  } while (after)
  for (let i = 0; i < toRemove.length; i++) {
    await resend.contacts.segments.remove({ email: toRemove[i], segmentId })
    if (i < toRemove.length - 1) await delay()
  }

  for (let i = 0; i < input.normalizedEmails.length; i++) {
    const email = input.normalizedEmails[i]
    const firstName = email.split('@')[0]
    const createRes = await resend.contacts.create({ email, firstName })
    if (createRes.error) {
      // Contact may already exist
    }
    await delay()
    const addRes = await resend.contacts.segments.add({ email, segmentId })
    if (addRes.error) {
      console.warn(`Failed to add ${email} to segment:`, addRes.error)
    }
    if (i < input.normalizedEmails.length - 1) await delay()
  }

  const campaignFrom =
    process.env.RESEND_FROM_CAMPAIGN ||
    process.env.RESEND_FROM_OVERRIDE ||
    process.env.RESEND_FROM_EMAIL ||
    'DUST Hair Studio <onboarding@resend.dev>'

  const { data: broadcastData, error: broadcastError } = await resend.broadcasts.create({
    segmentId,
    from: campaignFrom,
    replyTo: businessEmail || undefined,
    subject: subjectTemplate,
    html,
    send: true
  })

  if (broadcastError || !broadcastData?.id) {
    const errMsg = broadcastError?.message || JSON.stringify(broadcastError)
    return {
      success: false,
      error: 'Failed to send broadcast',
      details: errMsg
    }
  }

  const insertPayload: Record<string, unknown> = {
    campaign_id: input.campaignName || 'unknown',
    campaign_name: input.campaignName || 'Unknown Campaign',
    subject: input.subject,
    total_recipients: input.normalizedEmails.length,
    successful_sends: input.normalizedEmails.length,
    failed_sends: 0,
    recipient_emails: input.normalizedEmails,
    sent_by: input.sentBy
  }
  const { error: insertError } = await supabase
    .from('campaign_send_history')
    .insert({ ...insertPayload, send_details: null })

  if (insertError?.code === '42703') {
    await supabase.from('campaign_send_history').insert(insertPayload)
  } else if (insertError) {
    console.warn('Failed to log campaign send:', insertError)
  }

  return {
    success: true,
    total: input.normalizedEmails.length,
    broadcastId: broadcastData.id
  }
}
