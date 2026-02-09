import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/**
 * Escape HTML to prevent XSS when rendering user content in emails.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Convert plain text with simple formatting (Google Docs-style) to safe HTML for emails.
 * Supports: **bold**, __underline__, bullet lists (- item), and paragraph spacing.
 */
function formatCampaignMessage(message: string): string {
  const escaped = escapeHtml(message)

  // Split into paragraphs (double newline)
  const paragraphs = escaped.split(/\n\n+/)

  const formattedParagraphs = paragraphs.map((block) => {
    const lines = block.split('\n')
    const parts: string[] = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]
      // Bullet list: consecutive lines starting with "- "
      if (line.startsWith('- ') || /^[•]\s/.test(line)) {
        const listItems: string[] = []
        while (i < lines.length && (lines[i].startsWith('- ') || /^[•]\s/.test(lines[i]))) {
          const item = lines[i].replace(/^[-•]\s*/, '')
          listItems.push(`<li>${applyInlineFormatting(item)}</li>`)
          i++
        }
        parts.push(`<ul class="campaign-list">${listItems.join('')}</ul>`)
        continue
      }
      parts.push(applyInlineFormatting(line) + (i < lines.length - 1 ? '<br>' : ''))
      i++
    }

    return parts.join('')
  })

  return formattedParagraphs.map((p) => `<p class="campaign-paragraph">${p}</p>`).join('')
}

/** Apply **bold** and __underline__ within a line (no nesting). */
function applyInlineFormatting(line: string): string {
  let out = line
  // __underline__ (use double underscore to avoid breaking mid-word)
  out = out.replace(/__([^_]+)__/g, '<u>$1</u>')
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return out
}

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'div', 'span'])

/** Sanitize HTML from the rich text editor for email body (allow only safe tags). */
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

/** Render message body: use HTML if present (sanitized), else format plain text. */
function renderMessageBody(message: string): string {
  if (typeof message !== 'string') return ''
  const trimmed = message.trim()
  if (!trimmed) return ''
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return sanitizeCampaignHtml(trimmed)
  }
  return formatCampaignMessage(trimmed)
}

/** Replace campaign template variables with values for a given recipient. */
function replaceCampaignVariables(
  text: string,
  recipientEmail: string,
  opts: { campaignName?: string; businessName?: string }
): string {
  const now = new Date()
  const currentDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  return text
    .replace(/{email}/g, recipientEmail)
    .replace(/{customer_email}/g, recipientEmail)
    .replace(/{current_date}/g, currentDate)
    .replace(/{campaign_id}/g, opts.campaignName || '')
    .replace(/{your_name}/g, opts.businessName || '')
    .replace(/{customer_name}/g, recipientEmail.split('@')[0]) // fallback when no name available
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { emailList, subject, message, campaignName, registrationUrl, buttonText } = await request.json()

    if (!emailList || !Array.isArray(emailList) || emailList.length === 0) {
      return NextResponse.json({ error: 'Email list is required' }, { status: 400 })
    }

    if (!resend) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    // Get business settings
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['business_name', 'business_phone', 'business_email', 'business_address'])

    const settingsMap = settings?.reduce((acc: Record<string, string>, setting: { key: string; value: string }) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>) || {}

    const businessSettings = {
      business_name: settingsMap.business_name || 'DUST Studio',
      business_phone: settingsMap.business_phone || '',
      business_email: settingsMap.business_email || 'noreply@duststudio.com',
      business_address: settingsMap.business_address || ''
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const finalRegistrationUrl = registrationUrl ? `${baseUrl}${registrationUrl}` : `${baseUrl}/register/existing`

    const campaignReplaceOpts = {
      campaignName: campaignName || '',
      businessName: businessSettings.business_name || ''
    }

    function buildCampaignHtml(personalizedSubject: string, personalizedMessage: string): string {
      const finalButtonText = buttonText || ''
      return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapeHtml(personalizedSubject)}</title>
          <style>
              body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.7;
                  color: #1C1C1D;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
                  background-color: #FAFAFA;
              }
              .container {
                  background: #FAFAFA;
                  padding: 40px 20px;
              }
              .header {
                  text-align: center;
                  margin-bottom: 40px;
                  padding-bottom: 20px;
                  border-bottom: 1px solid #E5E5E5;
              }
              .logo {
                  font-size: 32px;
                  font-weight: bold;
                  color: #1C1C1D;
                  letter-spacing: 8px;
                  text-transform: uppercase;
              }
              .content {
                  background: #FFFFFF;
                  padding: 40px;
                  border: 1px solid #E5E5E5;
              }
              .message {
                  font-size: 15px;
                  color: #1C1C1D;
                  margin-bottom: 30px;
              }
              .message .campaign-paragraph {
                  margin: 0 0 1em 0;
              }
              .message .campaign-paragraph:last-child {
                  margin-bottom: 0;
              }
              .message strong {
                  font-weight: 700;
              }
              .message u {
                  text-decoration: underline;
              }
              .message ul,
              .message .campaign-list {
                  list-style: none;
                  margin: 0.75em 0 1em 0;
                  padding-left: 0;
              }
              .message ul li,
              .message .campaign-list li {
                  margin-bottom: 0.35em;
                  padding-left: 1.25em;
                  position: relative;
              }
              .message ul li::before,
              .message .campaign-list li::before {
                  content: "–";
                  font-weight: 700;
                  position: absolute;
                  left: 0;
              }
              .cta-container {
                  text-align: center;
                  margin: 35px 0;
              }
              .cta-button {
                  display: inline-block;
                  background: #1C1C1D;
                  color: #FFFFFF !important;
                  padding: 16px 40px;
                  text-decoration: none;
                  font-size: 14px;
                  font-weight: 500;
                  letter-spacing: 1px;
                  text-transform: uppercase;
                  border: none;
              }
              .cta-button:hover {
                  background: #333;
              }
              .footer {
                  text-align: center;
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #E5E5E5;
                  color: #666;
                  font-size: 13px;
              }
              .footer-logo {
                  font-size: 18px;
                  font-weight: bold;
                  color: #1C1C1D;
                  letter-spacing: 4px;
                  margin-bottom: 10px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <div class="logo">DUST</div>
              </div>
              
              <div class="content">
                  <div class="message">
                      ${renderMessageBody(personalizedMessage)}
                  </div>
                  
                  ${finalButtonText && registrationUrl ? `
                  <div class="cta-container">
                      <a href="${finalRegistrationUrl}" class="cta-button" style="color: #FFFFFF !important; text-decoration: none;">
                          ${finalButtonText}
                      </a>
                  </div>
                  ` : ''}
              </div>
              
              <div class="footer">
                  <div class="footer-logo">DUST</div>
                  <p>${businessSettings.business_address || '1942 Riverside Dr, Los Angeles, CA 90039'}</p>
                  <p>Questions? Reply to this email.</p>
              </div>
          </div>
      </body>
      </html>
    `
    }

    // Send emails in batches to avoid rate limits
    const batchSize = 10
    const results = []
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < emailList.length; i += batchSize) {
      const batch = emailList.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (recipientEmail: string) => {
        const personalizedSubject = replaceCampaignVariables(subject, recipientEmail, campaignReplaceOpts)
        const personalizedMessage = replaceCampaignVariables(message, recipientEmail, campaignReplaceOpts)
        const html = buildCampaignHtml(personalizedSubject, personalizedMessage)
        try {
          const campaignFrom = process.env.RESEND_FROM_CAMPAIGN || process.env.RESEND_FROM_OVERRIDE || process.env.RESEND_FROM_EMAIL || 'DUST Hair Studio <onboarding@resend.dev>'
          const { data, error } = await resend.emails.send({
            from: campaignFrom,
            to: [recipientEmail],
            replyTo: businessSettings.business_email || undefined,
            subject: personalizedSubject,
            text: personalizedMessage,
            html
          })

          if (error) {
            console.error(`Error sending to ${recipientEmail}:`, error)
            errorCount++
            return { email: recipientEmail, success: false, error: error.message }
          }

          successCount++
          return { email: recipientEmail, success: true, emailId: data?.id }
        } catch (error) {
          console.error(`Exception sending to ${recipientEmail}:`, error)
          errorCount++
          return { 
            email: recipientEmail, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Add delay between batches to respect rate limits
      if (i + batchSize < emailList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Log campaign send to history
    try {
      await supabase
        .from('campaign_send_history')
        .insert({
          campaign_id: campaignName || 'unknown',
          campaign_name: campaignName || 'Unknown Campaign',
          subject: subject,
          total_recipients: emailList.length,
          successful_sends: successCount,
          failed_sends: errorCount,
          recipient_emails: emailList,
          sent_by: user.id
        })
    } catch (logError) {
      console.warn('Failed to log campaign send:', logError)
    }

    return NextResponse.json({
      success: true,
      message: `Campaign sent to ${emailList.length} recipients`,
      results: {
        total: emailList.length,
        successful: successCount,
        failed: errorCount,
        details: results
      }
    })

  } catch (error) {
    console.error('Campaign send API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
