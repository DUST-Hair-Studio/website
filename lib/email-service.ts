import { Resend } from 'resend'
import { createAdminSupabaseClient } from './supabase-server'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailTemplate {
  id: string
  name: string
  type: 'confirmation' | 'reminder' | 'followup' | 'custom'
  subject: string
  message: string
  hours_before: number
  is_active: boolean
}

export interface BookingData {
  id: string
  booking_date: string
  booking_time: string
  duration_minutes: number
  services: {
    name: string
    duration_minutes: number
  }
  customers: {
    name: string
    email: string
    phone: string
  }
}

export interface BusinessSettings {
  business_name: string
  business_phone: string
  business_email: string
  business_address: string
  timezone: string
}

export class EmailService {
  private supabase = createAdminSupabaseClient()

  // Get business settings
  private async getBusinessSettings(): Promise<BusinessSettings> {
    const { data: settings } = await this.supabase
      .from('settings')
      .select('key, value')
      .in('key', ['business_name', 'business_phone', 'business_email', 'business_address', 'business_timezone'])

    const settingsMap = settings?.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, string>) || {}

    return {
      business_name: settingsMap.business_name || 'Your Business',
      business_phone: settingsMap.business_phone || '',
      business_email: settingsMap.business_email || 'noreply@yourbusiness.com',
      business_address: settingsMap.business_address || '',
      timezone: settingsMap.business_timezone || 'America/Los_Angeles'
    }
  }

  // Replace template variables with actual values
  private replaceTemplateVariables(
    template: string,
    booking: BookingData,
    businessSettings: BusinessSettings
  ): string {
    const appointmentDate = new Date(booking.booking_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: businessSettings.timezone
    })

    const appointmentTime = new Date(`${booking.booking_date}T${booking.booking_time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: businessSettings.timezone
    })

    const appointmentDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: businessSettings.timezone
    })

    return template
      .replace(/{customer_name}/g, booking.customers.name)
      .replace(/{appointment_date}/g, appointmentDate)
      .replace(/{appointment_time}/g, appointmentTime)
      .replace(/{appointment_datetime}/g, appointmentDateTime)
      .replace(/{service_name}/g, booking.services.name)
      .replace(/{business_name}/g, businessSettings.business_name)
      .replace(/{business_phone}/g, businessSettings.business_phone)
      .replace(/{business_address}/g, businessSettings.business_address)
      .replace(/{booking_id}/g, booking.id)
  }

  // Get active email template by type
  private async getEmailTemplate(type: 'confirmation' | 'reminder' | 'followup'): Promise<EmailTemplate | null> {
    const { data: template, error } = await this.supabase
      .from('reminder_templates')
      .select('*')
      .eq('type', type)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching email template:', error)
      return null
    }

    return template
  }

  // Send confirmation email immediately after booking
  async sendConfirmationEmail(booking: BookingData): Promise<boolean> {
    try {
      const template = await this.getEmailTemplate('confirmation')
      if (!template) {
        console.log('No active confirmation template found')
        return false
      }

      const businessSettings = await this.getBusinessSettings()
      
      // Check if email is enabled
      const { data: emailEnabled } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'email_enabled')
        .single()

      if (emailEnabled?.value === false) {
        console.log('Email notifications are disabled')
        return false
      }

      const subject = this.replaceTemplateVariables(template.subject, booking, businessSettings)
      const message = this.replaceTemplateVariables(template.message, booking, businessSettings)

      // Create HTML version of the message
      const htmlMessage = message.replace(/\n/g, '<br>')

      const { data, error } = await resend.emails.send({
        from: businessSettings.business_email,
        to: [booking.customers.email],
        subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${htmlMessage}
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666;">
              <p>Booking ID: ${booking.id}</p>
              <p>If you have any questions, please contact us at ${businessSettings.business_phone}</p>
            </div>
          </div>
        `
      })

      if (error) {
        console.error('Error sending confirmation email:', error)
        return false
      }

      console.log('Confirmation email sent successfully:', data)
      
      // Log the email send in reminder history
      await this.logEmailSend(booking.id, template.id, template.name, 'sent', data?.id)
      
      return true
    } catch (error) {
      console.error('Error in sendConfirmationEmail:', error)
      
      // Log the error
      await this.logEmailSend(booking.id, '', 'Confirmation', 'failed', undefined, error instanceof Error ? error.message : 'Unknown error')
      
      return false
    }
  }

  // Send reminder email (for scheduled reminders)
  async sendReminderEmail(booking: BookingData, templateId: string): Promise<boolean> {
    try {
      const { data: template, error: templateError } = await this.supabase
        .from('reminder_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (templateError || !template) {
        console.error('Error fetching reminder template:', templateError)
        return false
      }

      const businessSettings = await this.getBusinessSettings()
      
      const subject = this.replaceTemplateVariables(template.subject, booking, businessSettings)
      const message = this.replaceTemplateVariables(template.message, booking, businessSettings)

      const htmlMessage = message.replace(/\n/g, '<br>')

      const { data, error } = await resend.emails.send({
        from: businessSettings.business_email,
        to: [booking.customers.email],
        subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${htmlMessage}
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666;">
              <p>Booking ID: ${booking.id}</p>
              <p>If you need to reschedule, please contact us at ${businessSettings.business_phone}</p>
            </div>
          </div>
        `
      })

      if (error) {
        console.error('Error sending reminder email:', error)
        await this.logEmailSend(booking.id, templateId, template.name, 'failed', undefined, error.message)
        return false
      }

      console.log('Reminder email sent successfully:', data)
      await this.logEmailSend(booking.id, templateId, template.name, 'sent', data?.id)
      
      return true
    } catch (error) {
      console.error('Error in sendReminderEmail:', error)
      await this.logEmailSend(booking.id, templateId, 'Reminder', 'failed', undefined, error instanceof Error ? error.message : 'Unknown error')
      return false
    }
  }

  // Log email send in reminder history
  private async logEmailSend(
    bookingId: string,
    templateId: string,
    templateName: string,
    status: 'pending' | 'sent' | 'delivered' | 'failed',
    emailId?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('reminder_history')
        .insert({
          booking_id: bookingId,
          template_id: templateId,
          template_name: templateName,
          status,
          scheduled_for: new Date().toISOString(),
          sent_at: status === 'sent' ? new Date().toISOString() : null,
          error_message: errorMessage,
          email_id: emailId
        })
    } catch (error) {
      console.error('Error logging email send:', error)
    }
  }
}
