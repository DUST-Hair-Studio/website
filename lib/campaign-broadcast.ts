/**
 * Shared campaign broadcast logic - used by API (sync) and Inngest worker (async).
 *
 * Sends campaigns as personalized individual emails via the Resend batch API
 * (resend.batch.send, batches of 50) rather than a broadcast to a managed
 * segment. This avoids the segment-churn/throttle overhead and the associated
 * timeout, and lets us personalize and tag each message in code.
 */
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'
import type { CreateEmailOptions } from 'resend'

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

/**
 * Substitute campaign template tokens with real values for a single recipient.
 * (The broadcast path used Resend merge tags like {{{FIRST_NAME}}}; those only
 * resolve inside a managed segment, so per-recipient sends substitute directly.)
 */
function personalize(
  text: string,
  opts: { email: string; firstName: string; businessName: string; campaignName: string; currentDate: string }
): string {
  return text
    .replace(/{email}/g, opts.email)
    .replace(/{customer_email}/g, opts.email)
    .replace(/{customer_name}/g, opts.firstName)
    .replace(/{current_date}/g, opts.currentDate)
    .replace(/{campaign_id}/g, opts.campaignName)
    .replace(/{your_name}/g, opts.businessName)
    .replace(/{business_name}/g, opts.businessName)
}

// Resend tag values allow only [A-Za-z0-9_-], max 256 chars.
function sanitizeTagValue(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 256)
}

/**
 * Look up customer names by email, matched case-insensitively.
 * Customer emails are not guaranteed to be stored lowercase, and PostgREST
 * `.in()` matches case-sensitively — so we compare on a lowercased key on both
 * sides. Returns a map keyed by lowercased email. Paginated to stay correct if
 * the customers table grows beyond a single page.
 */
async function fetchCustomerNames(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  emails: string[]
): Promise<Map<string, string>> {
  const wanted = new Set(emails.map((e) => e.toLowerCase()))
  const nameByEmail = new Map<string, string>()
  if (wanted.size === 0) return nameByEmail
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('customers')
      .select('email, name')
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    for (const row of data as { email: string | null; name: string | null }[]) {
      if (!row.email) continue
      const key = row.email.toLowerCase()
      if (wanted.has(key)) nameByEmail.set(key, (row.name || '').trim())
    }
    if (data.length < PAGE) break
  }
  return nameByEmail
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

export interface CampaignSendDetail {
  email: string
  success: boolean
  messageId?: string
  error?: string
}

export interface CampaignBroadcastResult {
  success: true
  total: number
  successful: number
  failed: number
  details: CampaignSendDetail[]
  broadcastId: string
}

export interface CampaignBroadcastError {
  success: false
  error: string
  details?: string
}

export type CampaignBroadcastOutput = CampaignBroadcastResult | CampaignBroadcastError

const BATCH_SIZE = 50

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
  const finalButtonText = input.buttonText || ''
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const campaignFrom =
    process.env.RESEND_FROM_CAMPAIGN ||
    process.env.RESEND_FROM_OVERRIDE ||
    process.env.RESEND_FROM_EMAIL ||
    'DUST Hair Studio <onboarding@resend.dev>'

  const tagValue = input.campaignName ? sanitizeTagValue(input.campaignName) : ''

  // Build the branded HTML shell around a personalized subject + body.
  // NOTE: the old broadcast footer carried {{{RESEND_UNSUBSCRIBE_URL}}}, which
  // only resolves for Resend broadcasts to a managed segment. Batch/transactional
  // sends have no managed audience, so that token would render literally and the
  // opt-out would not be honored. The unsubscribe link is intentionally omitted
  // here — TODO: add self-hosted unsubscribe (List-Unsubscribe header + suppression
  // table) before relying on this for marketing sends.
  const buildHtml = (subject: string, htmlBody: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
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
      <p>Questions? Reply to this email.</p>
    </div>
  </div>
</body>
</html>
`

  // Resolve real customer names (the customers table stores a single `name`),
  // matched by email case-insensitively. Falls back to "there" when a recipient
  // isn't a known customer, so greetings never show an email prefix or empty name.
  const nameByEmail = await fetchCustomerNames(supabase, input.normalizedEmails)

  // One personalized email per recipient.
  const emails: CreateEmailOptions[] = input.normalizedEmails.map((email) => {
    const firstName = (nameByEmail.get(email) || '').split(/\s+/)[0] || 'there'
    const opts = { email, firstName, businessName, campaignName: input.campaignName || '', currentDate }
    const subject = personalize(input.subject, opts)
    const htmlBody = renderMessageBody(personalize(input.message, opts))
    const message: CreateEmailOptions = {
      from: campaignFrom,
      to: [email],
      subject,
      html: buildHtml(subject, htmlBody)
    }
    if (businessEmail) message.replyTo = businessEmail
    if (tagValue) message.tags = [{ name: 'campaign_id', value: tagValue }]
    return message
  })

  // Send in batches of 50 via the Resend batch API. The batch response returns
  // ids in the same order as the input array, so each recipient is matched to
  // its result by position. Failures are captured per recipient, never thrown —
  // a thrown error would let a caller retry and re-send to recipients who
  // already received the email.
  const details: CampaignSendDetail[] = []
  let firstId: string | null = null

  for (let start = 0; start < emails.length; start += BATCH_SIZE) {
    const chunk = emails.slice(start, start + BATCH_SIZE)
    const chunkEmails = input.normalizedEmails.slice(start, start + BATCH_SIZE)
    try {
      const { data, error } = await resend.batch.send(chunk)
      if (error || !data?.data) {
        const message = error?.message || JSON.stringify(error) || 'Batch send failed'
        for (const email of chunkEmails) details.push({ email, success: false, error: message })
        continue
      }
      chunkEmails.forEach((email, j) => {
        const id = data.data[j]?.id
        if (id) {
          details.push({ email, success: true, messageId: id })
          if (!firstId) firstId = id
        } else {
          details.push({ email, success: false, error: 'No message id returned' })
        }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      for (const email of chunkEmails) details.push({ email, success: false, error: message })
    }
  }

  const successfulSends = details.filter((d) => d.success).length
  const failedSends = details.length - successfulSends

  if (successfulSends === 0) {
    return {
      success: false,
      error: 'Campaign failed to send',
      details: details.map((d) => d.error).filter(Boolean).join('; ') || undefined
    }
  }

  const insertPayload: Record<string, unknown> = {
    campaign_id: input.campaignName || 'unknown',
    campaign_name: input.campaignName || 'Unknown Campaign',
    subject: input.subject,
    total_recipients: input.normalizedEmails.length,
    successful_sends: successfulSends,
    failed_sends: failedSends,
    recipient_emails: input.normalizedEmails,
    sent_by: input.sentBy
  }
  const { error: insertError } = await supabase
    .from('campaign_send_history')
    .insert({ ...insertPayload, send_details: details })

  if (insertError?.code === '42703') {
    await supabase.from('campaign_send_history').insert(insertPayload)
  } else if (insertError) {
    console.warn('Failed to log campaign send:', insertError)
  }

  return {
    success: true,
    total: input.normalizedEmails.length,
    successful: successfulSends,
    failed: failedSends,
    details,
    broadcastId: firstId || 'batch'
  }
}
