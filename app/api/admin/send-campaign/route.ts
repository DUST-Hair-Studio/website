import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Resend } from 'resend'

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

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

    // Create dynamic HTML email template with DUST branding
    const finalButtonText = buttonText || ''
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
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
                      ${message.replace(/\n/g, '<br>')}
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

    // Send emails in batches to avoid rate limits
    const batchSize = 10
    const results = []
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < emailList.length; i += batchSize) {
      const batch = emailList.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (email: string) => {
        try {
          const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_OVERRIDE || businessSettings.business_email,
            to: [email],
            subject,
            text: message,
            html: htmlTemplate
          })

          if (error) {
            console.error(`Error sending to ${email}:`, error)
            errorCount++
            return { email, success: false, error: error.message }
          }

          successCount++
          return { email, success: true, emailId: data?.id }
        } catch (error) {
          console.error(`Exception sending to ${email}:`, error)
          errorCount++
          return { 
            email, 
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
