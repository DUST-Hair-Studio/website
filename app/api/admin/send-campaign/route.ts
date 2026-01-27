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

    const { emailList, subject, message, campaignName, registrationUrl } = await request.json()

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

    // Create dynamic HTML email template
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
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
              }
              .header {
                  text-align: center;
                  margin-bottom: 30px;
              }
              .logo {
                  font-size: 24px;
                  font-weight: bold;
                  color: #000;
              }
              .content {
                  background: #fff;
                  padding: 30px;
                  border-radius: 8px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              .cta-button {
                  display: inline-block;
                  background: #000;
                  color: #ffffff !important;
                  padding: 15px 30px;
                  text-decoration: none;
                  border-radius: 5px;
                  font-weight: bold;
                  margin: 20px 0;
                  text-align: center;
                  border: none;
              }
              .footer {
                  text-align: center;
                  margin-top: 30px;
                  color: #666;
                  font-size: 14px;
              }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo">${businessSettings.business_name}</div>
          </div>
          
          <div class="content">
              ${message.replace(/\n/g, '<br>')}
              
              <div style="text-align: center;">
                  <a href="${finalRegistrationUrl}" class="cta-button" style="color: #ffffff !important; text-decoration: none;">
                      Create Your Account
                  </a>
              </div>
          </div>
          
          <div class="footer">
              <p>${businessSettings.business_name} | ${businessSettings.business_phone}</p>
              <p>If you have any questions, please reply to this email.</p>
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
            from: businessSettings.business_email,
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

    // Log campaign results
    try {
      await supabase
        .from('campaign_registrations')
        .insert({
          email: 'campaign_log',
          campaign_name: campaignName || 'existing_customer_2024',
          registration_url: 'bulk_send',
          is_existing_customer: false
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
