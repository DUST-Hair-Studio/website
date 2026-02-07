import { createAdminSupabaseClient } from './supabase-server'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export interface WaitlistNotificationData {
  booking_date: string
  booking_time: string
  service_id: string
}

export class WaitlistService {
  private supabase = createAdminSupabaseClient()

  /**
   * Check and notify waitlist users when an appointment becomes available
   * Called when a booking is cancelled or rescheduled (freeing up a slot)
   */
  async notifyWaitlist(data: WaitlistNotificationData): Promise<void> {
    try {
      console.log('🔔 Checking waitlist for available slot:', data)

      const { booking_date, booking_time, service_id } = data

      // Find pending waitlist requests that match this date and service
      const { data: waitlistRequests, error: waitlistError } = await this.supabase
        .from('waitlist_requests')
        .select(`
          *,
          services (
            name,
            duration_minutes
          ),
          customers (
            name,
            email,
            phone
          )
        `)
        .eq('service_id', service_id)
        .eq('status', 'pending')
        .lte('start_date', booking_date)
        .gte('end_date', booking_date)
        .order('created_at', { ascending: true }) // First-come, first-served

      if (waitlistError) {
        console.error('Error fetching waitlist requests:', waitlistError)
        return
      }

      if (!waitlistRequests || waitlistRequests.length === 0) {
        console.log('No matching waitlist requests found')
        return
      }

      console.log(`Found ${waitlistRequests.length} matching waitlist requests`)

      // Get business settings for email
      const businessSettings = await this.getBusinessSettings()

      // Notify all matching waitlist users
      for (const request of waitlistRequests) {
        try {
          // Send notification email
          const emailSent = await this.sendWaitlistNotificationEmail(
            request,
            booking_date,
            booking_time,
            businessSettings
          )

          if (emailSent) {
            // Update waitlist status to notified
            const expiresAt = new Date()
            expiresAt.setHours(expiresAt.getHours() + 48) // 48 hour window to book

            await this.supabase
              .from('waitlist_requests')
              .update({
                status: 'notified',
                notified_at: new Date().toISOString(),
                expires_at: expiresAt.toISOString()
              })
              .eq('id', request.id)

            console.log(`✅ Notified waitlist user: ${request.customers.email}`)
          }
        } catch (error) {
          console.error(`Error notifying waitlist user ${request.id}:`, error)
          // Continue with next user even if one fails
        }
      }
    } catch (error) {
      console.error('Error in notifyWaitlist:', error)
    }
  }

  /**
   * Get business settings from database
   */
  private async getBusinessSettings() {
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

  /**
   * Send waitlist notification email
   */
  private async sendWaitlistNotificationEmail(
    waitlistRequest: { 
      customer_id: string; 
      service_id: string;
      start_date: string;
      end_date: string;
      services: { name: string };
      customers: { name: string; email: string };
    },
    availableDate: string,
    availableTime: string,
    businessSettings: { business_name: string; timezone: string; business_phone: string; business_email: string }
  ): Promise<boolean> {
    try {
      if (!resend) {
        console.log('Resend API key not configured, skipping email')
        return false
      }

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

      // Format the date and time for display
      const appointmentDate = new Date(availableDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: businessSettings.timezone
      })

      const appointmentTime = new Date(`${availableDate}T${availableTime}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: businessSettings.timezone
      })

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const bookingLink = `${baseUrl}/book?serviceId=${waitlistRequest.service_id}`

      const subject = `Appointment Available - ${appointmentDate}`
      const message = `Hi ${waitlistRequest.customers.name},

Good news! An appointment slot has opened up for ${waitlistRequest.services.name}.

Available Date: ${appointmentDate}
Available Time: ${appointmentTime}

This appointment is available on a first-come, first-served basis. Book now to secure your spot!

To book this appointment, click the link below:
${bookingLink}

This notification is part of our waitlist service. You requested to be notified about availability between ${new Date(waitlistRequest.start_date).toLocaleDateString()} and ${new Date(waitlistRequest.end_date).toLocaleDateString()}.

Best regards,
${businessSettings.business_name}
${businessSettings.business_phone}`

      const htmlMessage = message.replace(/\n/g, '<br>')

      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_OVERRIDE || businessSettings.business_email,
        to: [waitlistRequest.customers.email],
        subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <p style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 600;">
                🎉 Great news! A spot has opened up!
              </p>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${htmlMessage}
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${bookingLink}" style="display: inline-block; background-color: #1C1C1D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Book This Appointment
              </a>
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666;">
              <p>⏰ This notification is time-sensitive. Book soon to secure your spot!</p>
              <p>If you have any questions, please contact us at ${businessSettings.business_phone}</p>
            </div>
          </div>
        `
      })

      if (error) {
        console.error('Error sending waitlist notification email:', error)
        return false
      }

      console.log('Waitlist notification email sent successfully:', data)
      return true

    } catch (error) {
      console.error('Error in sendWaitlistNotificationEmail:', error)
      return false
    }
  }

  /**
   * Clean up expired waitlist notifications
   * Should be called periodically (e.g., daily cron job)
   */
  async cleanupExpiredWaitlist(): Promise<void> {
    try {
      const now = new Date().toISOString()

      // Mark expired notified entries
      await this.supabase
        .from('waitlist_requests')
        .update({ status: 'expired' })
        .eq('status', 'notified')
        .lt('expires_at', now)

      // Also mark old pending requests as expired (e.g., if end_date has passed)
      await this.supabase
        .from('waitlist_requests')
        .update({ status: 'expired' })
        .eq('status', 'pending')
        .lt('end_date', new Date().toISOString().split('T')[0])

      console.log('Cleaned up expired waitlist entries')
    } catch (error) {
      console.error('Error cleaning up expired waitlist:', error)
    }
  }
}

// Export a singleton instance
export const waitlistService = new WaitlistService()

