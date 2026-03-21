import { Resend } from 'resend'
import { createAdminSupabaseClient } from './supabase-server'
import { createBusinessDateTimeSync } from './timezone-utils'
import { buildConfirmationICS, buildCancellationICS } from './calendar-invite'

// Only initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// Resend must send FROM a verified domain. Business email is for templates and replyTo only.
const getResendFromAddress = () =>
  process.env.RESEND_FROM_OVERRIDE ||
  process.env.RESEND_FROM_EMAIL ||
  'DUST Hair Studio <onboarding@resend.dev>'

export interface EmailTemplate {
  id: string
  name: string
  type: 'confirmation' | 'reminder' | 'followup' | 'cancellation' | 'reschedule' | 'waitlist' | 'payment_link' | 'custom'
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
  price_charged: number
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

export interface PaymentLinkData extends BookingData {
  paymentUrl: string
  orderId: string
  paymentLinkId: string
}

export interface BusinessSettings {
  business_name: string
  business_phone: string
  business_email: string
  business_address: string
  timezone: string
}

export interface WaitlistConfirmationData {
  customer: {
    name: string
    email: string
  }
  service: {
    name: string
  }
  start_date: string
  end_date: string
}

export class EmailService {
  private supabase = createAdminSupabaseClient()

  private async createPendingReminderHistory(
    bookingId: string,
    templateId: string,
    templateName: string
  ): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('reminder_history')
        .insert({
          booking_id: bookingId,
          template_id: templateId,
          template_name: templateName,
          status: 'pending',
          scheduled_for: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) {
        console.error('Error creating pending reminder history row:', error)
        return null
      }

      return data?.id ?? null
    } catch (error) {
      console.error('Error creating pending reminder history row:', error)
      return null
    }
  }

  private async updateReminderHistoryStatus(
    reminderHistoryId: string,
    status: 'sent' | 'failed',
    options?: { errorMessage?: string; emailId?: string }
  ): Promise<void> {
    try {
      const updateData: {
        status: 'sent' | 'failed'
        sent_at?: string
        error_message?: string | null
        email_id?: string
      } = {
        status
      }

      if (status === 'sent') {
        updateData.sent_at = new Date().toISOString()
        updateData.error_message = null
      }

      if (status === 'failed') {
        updateData.error_message = options?.errorMessage || 'Unknown error'
      }

      if (options?.emailId) {
        updateData.email_id = options.emailId
      }

      const runUpdate = async (
        payload: {
          status: 'sent' | 'failed'
          sent_at?: string
          error_message?: string | null
          email_id?: string
        }
      ) =>
        this.supabase
          .from('reminder_history')
          .update(payload)
          .eq('id', reminderHistoryId)
          .select('id')

      let { data, error } = await runUpdate(updateData)

      // Some environments may not have reminder_history.email_id yet.
      // Retry without email_id so status/sent_at still update.
      if (
        error &&
        updateData.email_id &&
        error.code === 'PGRST204' &&
        error.message?.includes("'email_id'")
      ) {
        console.warn(
          `reminder_history.email_id missing; retrying status update without email_id for ${reminderHistoryId}`
        )
        const { email_id: _ignoredEmailId, ...updateDataWithoutEmailId } = updateData
        const retryResult = await runUpdate(updateDataWithoutEmailId)
        data = retryResult.data
        error = retryResult.error
      }

      if (error) {
        console.error(`Failed to update reminder history ${reminderHistoryId}:`, error)
        return
      }

      if (!data || data.length === 0) {
        console.error(`No reminder_history row updated for id ${reminderHistoryId}`)
      }
    } catch (error) {
      console.error(`Error updating reminder history ${reminderHistoryId}:`, error)
    }
  }

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
    if (!template || typeof template !== 'string') return ''
    const tz = businessSettings?.timezone ?? 'America/Los_Angeles'
    // Interpret booking_date/booking_time as business-timezone local time (PST), not server UTC
    const appointmentDateObj = createBusinessDateTimeSync(booking.booking_date, '00:00:00', tz)
    const appointmentDateTimeObj = createBusinessDateTimeSync(booking.booking_date, booking.booking_time, tz)

    const appointmentDate = appointmentDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: tz
    })

    const appointmentTime = appointmentDateTimeObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz
    })

    const appointmentDateTime = appointmentDateTimeObj.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz
    })

    const customerName = booking?.customers?.name ?? ''
    const customerEmail = booking?.customers?.email ?? ''
    const serviceName = booking?.services?.name ?? ''
    const businessName = businessSettings?.business_name ?? ''
    const businessEmail = businessSettings?.business_email ?? ''
    const businessPhone = businessSettings?.business_phone ?? ''
    const businessAddress = businessSettings?.business_address ?? ''
    const bookingId = booking?.id ?? ''

    // Replace longer placeholders first so substrings aren't corrupted (e.g. {appointment_datetime} before {appointment_date})
    // {date}/{time} match legacy settings copy (e.g. confirmation_message / reminder_message)
    return template
      .replace(/{appointment_datetime}/g, appointmentDateTime)
      .replace(/{appointment_date}/g, appointmentDate)
      .replace(/{appointment_time}/g, appointmentTime)
      .replace(/{date}/g, appointmentDate)
      .replace(/{time}/g, appointmentTime)
      .replace(/{business_email}/g, businessEmail)
      .replace(/{email}/g, businessEmail)
      .replace(/{customer_email}/g, customerEmail)
      .replace(/{customer_name}/g, customerName)
      .replace(/{service_name}/g, serviceName)
      .replace(/{business_name}/g, businessName)
      .replace(/{business_phone}/g, businessPhone)
      .replace(/{business_address}/g, businessAddress)
      .replace(/{booking_id}/g, bookingId)
  }

  // Get active email template by type
  private async getEmailTemplate(type: 'confirmation' | 'reminder' | 'followup' | 'cancellation' | 'reschedule' | 'waitlist' | 'payment_link'): Promise<EmailTemplate | null> {
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
  async sendConfirmationEmail(booking: BookingData, reminderHistoryId?: string): Promise<boolean> {
    let trackedReminderHistoryId: string | null | undefined = reminderHistoryId

    try {
      // Check if Resend is configured
      if (!resend) {
        console.log('Resend API key not configured, skipping email')
        return false
      }

      const template = await this.getEmailTemplate('confirmation')
      if (!template) {
        console.log('No active confirmation template found')
        return false
      }

      // If caller did not provide a row to update, create one so sent_at/status are always tracked.
      if (!trackedReminderHistoryId) {
        trackedReminderHistoryId = await this.createPendingReminderHistory(booking.id, template.id, template.name)
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

      // Generate appointment management link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const appointmentsUrl = `${baseUrl}/appointments`

      // Build ICS calendar attachment and Google Calendar link
      const icsInput = {
        bookingId: booking.id,
        date: booking.booking_date,
        time: booking.booking_time,
        durationMinutes: booking.duration_minutes,
        clientName: booking.customers?.name ?? '',
        serviceName: booking.services?.name ?? '',
        businessTimezone: businessSettings.timezone,
        location: businessSettings.business_address || undefined,
      }
      const icsContent = buildConfirmationICS(icsInput)

      const { data, error } = await resend.emails.send({
        from: getResendFromAddress(),
        replyTo: businessSettings.business_email || undefined,
        to: [booking.customers.email],
        subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${htmlMessage}
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appointmentsUrl}" style="display: inline-block; background-color: #1C1C1D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Manage Your Appointment
              </a>
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666;">
              <p>Booking ID: ${booking.id}</p>
              <p>Need to reschedule? <a href="${appointmentsUrl}" style="color: #1C1C1D;">Click here to manage your appointment</a></p>
              <p>If you have any questions, please contact us at ${businessSettings.business_phone}</p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: 'appointment.ics',
            content: icsContent,
          },
        ],
      })

      if (error) {
        console.error('Error sending confirmation email:', error)
        if (trackedReminderHistoryId) {
          await this.updateReminderHistoryStatus(trackedReminderHistoryId, 'failed', {
            errorMessage: error.message
          })
        }
        return false
      }

      console.log('Confirmation email sent successfully:', data)
      
      if (trackedReminderHistoryId) {
        await this.updateReminderHistoryStatus(trackedReminderHistoryId, 'sent', { emailId: data?.id })
      } else {
        // Fallback if history row creation failed unexpectedly
        await this.logEmailSend(booking.id, template.id, template.name, 'sent', data?.id)
      }
      
      return true
    } catch (error) {
      console.error('Error in sendConfirmationEmail:', error)
      
      if (trackedReminderHistoryId) {
        await this.updateReminderHistoryStatus(trackedReminderHistoryId, 'failed', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      } else {
        // Log the error
        await this.logEmailSend(booking.id, '', 'Confirmation', 'failed', undefined, error instanceof Error ? error.message : 'Unknown error')
      }
      
      return false
    }
  }

  // Send reminder email (for scheduled reminders)
  async sendReminderEmail(booking: BookingData, templateId: string, reminderHistoryId?: string): Promise<boolean> {
    try {
      if (!resend) {
        console.log('Resend API key not configured, skipping email')
        if (reminderHistoryId) {
          await this.updateReminderHistoryStatus(reminderHistoryId, 'failed', {
            errorMessage: 'Resend API key not configured'
          })
        }
        return false
      }

      const toEmail = booking?.customers?.email
      if (!toEmail || typeof toEmail !== 'string') {
        console.error('Reminder skipped: no customer email for booking', booking?.id)
        if (reminderHistoryId) {
          await this.updateReminderHistoryStatus(reminderHistoryId, 'failed', {
            errorMessage: 'No customer email'
          })
        }
        return false
      }

      const { data: template, error: templateError } = await this.supabase
        .from('reminder_templates')
        .select('*')
        .eq('id', templateId)
        .single()

      if (templateError || !template) {
        console.error('Error fetching reminder template:', templateError)
        if (reminderHistoryId) {
          await this.updateReminderHistoryStatus(reminderHistoryId, 'failed', {
            errorMessage: templateError?.message || 'Reminder template not found'
          })
        }
        return false
      }

      const businessSettings = await this.getBusinessSettings()
      
      const subject = this.replaceTemplateVariables(template.subject, booking, businessSettings)
      const message = this.replaceTemplateVariables(template.message, booking, businessSettings)

      const htmlMessage = message.replace(/\n/g, '<br>')

      const { data, error } = await resend.emails.send({
        from: getResendFromAddress(),
        replyTo: businessSettings.business_email || undefined,
        to: [toEmail],
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
              <p>If you need to reschedule, please contact us at ${businessSettings?.business_phone ?? ''}</p>
            </div>
          </div>
        `
      })

      if (error) {
        console.error('Error sending reminder email:', error)
        if (reminderHistoryId) {
          await this.updateReminderHistoryStatus(reminderHistoryId, 'failed', {
            errorMessage: error.message
          })
        } else {
          await this.logEmailSend(booking.id, templateId, template.name, 'failed', undefined, error.message)
        }
        return false
      }

      console.log('Reminder email sent successfully:', data)
      if (reminderHistoryId) {
        await this.updateReminderHistoryStatus(reminderHistoryId, 'sent', { emailId: data?.id })
      } else {
        await this.logEmailSend(booking.id, templateId, template.name, 'sent', data?.id)
      }
      
      return true
    } catch (error) {
      console.error('Error in sendReminderEmail:', error)
      if (reminderHistoryId) {
        await this.updateReminderHistoryStatus(reminderHistoryId, 'failed', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      } else {
        await this.logEmailSend(booking.id, templateId, 'Reminder', 'failed', undefined, error instanceof Error ? error.message : 'Unknown error')
      }
      return false
    }
  }

  // Send cancellation email when booking is cancelled
  async sendCancellationEmail(booking: BookingData, reminderHistoryId?: string): Promise<boolean> {
    let trackedReminderHistoryId: string | null | undefined = reminderHistoryId

    try {
      if (!resend) {
        console.log('Resend API key not configured, skipping email')
        return false
      }

      const toEmail = booking?.customers?.email
      if (!toEmail || typeof toEmail !== 'string') {
        console.error('Cancellation email skipped: no customer email for booking', booking?.id)
        return false
      }

      const template = await this.getEmailTemplate('cancellation')
      if (!template) {
        console.log('No active cancellation template found')
        return false
      }

      if (!trackedReminderHistoryId) {
        trackedReminderHistoryId = await this.createPendingReminderHistory(booking.id, template.id, template.name)
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

      const htmlMessage = message.replace(/\n/g, '<br>')

      // Build ICS cancellation attachment (METHOD:CANCEL so calendar clients remove the event)
      const icsInput = {
        bookingId: booking.id,
        date: booking.booking_date,
        time: booking.booking_time,
        durationMinutes: booking.duration_minutes,
        clientName: booking.customers?.name ?? '',
        serviceName: booking.services?.name ?? '',
        businessTimezone: businessSettings.timezone,
        location: businessSettings.business_address || undefined,
      }
      const icsContent = buildCancellationICS(icsInput)

      const { data, error } = await resend.emails.send({
        from: getResendFromAddress(),
        replyTo: businessSettings.business_email || undefined,
        to: [toEmail],
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
              <p>If you have any questions, please contact us at ${businessSettings?.business_phone ?? ''}</p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: 'appointment.ics',
            content: icsContent,
          },
        ],
      })

      if (error) {
        console.error('Error sending cancellation email:', error)
        if (trackedReminderHistoryId) {
          await this.updateReminderHistoryStatus(trackedReminderHistoryId, 'failed', {
            errorMessage: error.message
          })
        } else {
          await this.logEmailSend(booking.id, template.id, template.name, 'failed', undefined, error.message)
        }
        return false
      }

      console.log('Cancellation email sent successfully:', data)
      if (trackedReminderHistoryId) {
        await this.updateReminderHistoryStatus(trackedReminderHistoryId, 'sent', { emailId: data?.id })
      } else {
        await this.logEmailSend(booking.id, template.id, template.name, 'sent', data?.id)
      }
      
      return true
    } catch (error) {
      console.error('Error in sendCancellationEmail:', error)
      if (trackedReminderHistoryId) {
        await this.updateReminderHistoryStatus(trackedReminderHistoryId, 'failed', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      } else {
        await this.logEmailSend(booking.id, '', 'Cancellation', 'failed', undefined, error instanceof Error ? error.message : 'Unknown error')
      }
      return false
    }
  }

  // Send reschedule email when booking is rescheduled
  async sendRescheduleEmail(booking: BookingData, oldDate?: string, oldTime?: string, reminderHistoryId?: string): Promise<boolean> {
    let trackedReminderHistoryId: string | null | undefined = reminderHistoryId

    try {
      console.log('📧 [RESCHEDULE EMAIL] Starting sendRescheduleEmail for booking:', booking.id)
      
      // Check if Resend is configured
      if (!resend) {
        console.log('❌ [RESCHEDULE EMAIL] Resend API key not configured, skipping email')
        return false
      }
      console.log('✅ [RESCHEDULE EMAIL] Resend API key configured')

      const template = await this.getEmailTemplate('reschedule')
      if (!template) {
        console.log('❌ [RESCHEDULE EMAIL] No active reschedule template found')
        return false
      }
      console.log('✅ [RESCHEDULE EMAIL] Template found:', template.name)

      if (!trackedReminderHistoryId) {
        trackedReminderHistoryId = await this.createPendingReminderHistory(booking.id, template.id, template.name)
      }

      const businessSettings = await this.getBusinessSettings()
      console.log('✅ [RESCHEDULE EMAIL] Business settings loaded')
      
      // Check if email is enabled
      const { data: emailEnabled } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'email_enabled')
        .single()

      if (emailEnabled?.value === false) {
        console.log('❌ [RESCHEDULE EMAIL] Email notifications are disabled')
        return false
      }
      console.log('✅ [RESCHEDULE EMAIL] Email notifications enabled')

      let subject = this.replaceTemplateVariables(template.subject, booking, businessSettings)
      let message = this.replaceTemplateVariables(template.message, booking, businessSettings)
      console.log('✅ [RESCHEDULE EMAIL] Variables replaced in template')

      // Add old date/time info if provided (interpret as business timezone)
      if (oldDate && oldTime) {
        console.log('📅 [RESCHEDULE EMAIL] Old date/time provided:', { oldDate, oldTime })
        const tz = businessSettings.timezone
        const oldDateObj = createBusinessDateTimeSync(oldDate, '00:00:00', tz)
        const oldDateTimeObj = createBusinessDateTimeSync(oldDate, oldTime, tz)
        const oldAppointmentDate = oldDateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: tz
        })

        const oldAppointmentTime = oldDateTimeObj.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: tz
        })

        console.log('📅 [RESCHEDULE EMAIL] Formatted old date/time:', { oldAppointmentDate, oldAppointmentTime })

        message = message
          .replace(/{old_appointment_date}/g, oldAppointmentDate)
          .replace(/{old_appointment_time}/g, oldAppointmentTime)
        
        subject = subject
          .replace(/{old_appointment_date}/g, oldAppointmentDate)
          .replace(/{old_appointment_time}/g, oldAppointmentTime)
      } else {
        console.log('⚠️ [RESCHEDULE EMAIL] No old date/time provided - will show as placeholders')
      }

      const htmlMessage = message.replace(/\n/g, '<br>')

      // Generate appointment management link
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const appointmentsUrl = `${baseUrl}/appointments`

      // Build ICS for NEW date/time (adds/updates the event)
      const newIcsInput = {
        bookingId: booking.id,
        date: booking.booking_date,
        time: booking.booking_time,
        durationMinutes: booking.duration_minutes,
        clientName: booking.customers?.name ?? '',
        serviceName: booking.services?.name ?? '',
        businessTimezone: businessSettings.timezone,
        location: businessSettings.business_address || undefined,
        sequence: 1,
      }
      const icsContent = buildConfirmationICS(newIcsInput)

      // For reschedule: also send CANCEL for OLD date/time first, so calendar removes
      // the original event. Many clients (Apple Calendar, Outlook) don't replace
      // on REQUEST alone—they add a duplicate. Cancel-then-confirm works reliably.
      const attachments: { filename: string; content: string }[] = []
      if (oldDate && oldTime) {
        const cancelIcsInput = {
          ...newIcsInput,
          date: oldDate,
          time: oldTime,
        }
        attachments.push({
          filename: 'appointment-cancel.ics',
          content: buildCancellationICS(cancelIcsInput),
        })
      }
      attachments.push({
        filename: 'appointment.ics',
        content: icsContent,
      })

      const { data, error } = await resend.emails.send({
        from: getResendFromAddress(),
        replyTo: businessSettings.business_email || undefined,
        to: [booking.customers.email],
        subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${htmlMessage}
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appointmentsUrl}" style="display: inline-block; background-color: #1C1C1D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Manage Your Appointment
              </a>
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666;">
              <p>Booking ID: ${booking.id}</p>
              <p>Need to reschedule again? <a href="${appointmentsUrl}" style="color: #1C1C1D;">Click here to manage your appointment</a></p>
              <p>If you have any questions, please contact us at ${businessSettings.business_phone}</p>
            </div>
          </div>
        `,
        attachments,
      })

      if (error) {
        console.error('❌ [RESCHEDULE EMAIL] Error sending via Resend:', error)
        if (trackedReminderHistoryId) {
          await this.updateReminderHistoryStatus(trackedReminderHistoryId, 'failed', {
            errorMessage: error.message
          })
        } else {
          await this.logEmailSend(booking.id, template.id, template.name, 'failed', undefined, error.message)
        }
        return false
      }

      console.log('✅ [RESCHEDULE EMAIL] Email sent successfully!', { emailId: data?.id, to: booking.customers.email })
      if (trackedReminderHistoryId) {
        await this.updateReminderHistoryStatus(trackedReminderHistoryId, 'sent', { emailId: data?.id })
      } else {
        await this.logEmailSend(booking.id, template.id, template.name, 'sent', data?.id)
      }
      
      return true
    } catch (error) {
      console.error('❌ [RESCHEDULE EMAIL] Exception in sendRescheduleEmail:', error)
      if (trackedReminderHistoryId) {
        await this.updateReminderHistoryStatus(trackedReminderHistoryId, 'failed', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
      } else {
        await this.logEmailSend(booking.id, '', 'Reschedule', 'failed', undefined, error instanceof Error ? error.message : 'Unknown error')
      }
      return false
    }
  }

  // Send waitlist confirmation email when customer joins waitlist
  async sendWaitlistConfirmationEmail(data: WaitlistConfirmationData): Promise<boolean> {
    try {
      console.log('📧 [WAITLIST CONFIRMATION] Starting to send confirmation email')

      // Check if Resend is configured
      if (!resend) {
        console.log('❌ [WAITLIST CONFIRMATION] Resend API key not configured')
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
        console.log('❌ [WAITLIST CONFIRMATION] Email notifications are disabled')
        return false
      }

      // Format dates for display (interpret YYYY-MM-DD as business-timezone date)
      const formatDateForEmail = (dateString: string, timezone: string) => {
        const dateObj = createBusinessDateTimeSync(dateString, '00:00:00', timezone)
        return dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: timezone
        })
      }

      const startDateFormatted = formatDateForEmail(data.start_date, businessSettings.timezone)
      const endDateFormatted = formatDateForEmail(data.end_date, businessSettings.timezone)

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const appointmentsUrl = `${baseUrl}/appointments`

      const subject = `You're on the Waitlist - ${data.service.name}`
      const message = `Hi ${data.customer.name},

You've been successfully added to the waitlist for ${data.service.name}!

Date Range: ${startDateFormatted} to ${endDateFormatted}

What happens next?
• We'll automatically check for available appointments in this date range
• You'll receive an email notification if a spot opens up
• Available slots are first-come, first-served
• You'll have 48 hours to book after receiving a notification

You can view your waitlist requests anytime in your account.

Best regards,
${businessSettings.business_name}
${businessSettings.business_phone}`

      // const htmlMessage = message.replace(/\n/g, '<br>')

      const { data: emailData, error } = await resend.emails.send({
        from: getResendFromAddress(),
        replyTo: businessSettings.business_email || undefined,
        to: [data.customer.email],
        subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <p style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 600;">
                ✅ You're on the waitlist!
              </p>
            </div>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Service:</strong> ${data.service.name}</p>
              <p style="margin: 0 0 10px 0;"><strong>Date Range:</strong> ${startDateFormatted} to ${endDateFormatted}</p>
              <br>
              <p style="margin: 0 0 10px 0;"><strong>What happens next?</strong></p>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>We'll automatically check for available appointments daily</li>
                <li>You'll receive an email if a spot opens up in your date range</li>
                <li>Available slots are first-come, first-served</li>
                <li>You'll have 48 hours to book after receiving a notification</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appointmentsUrl}" style="display: inline-block; background-color: #1C1C1D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                View My Appointments
              </a>
            </div>
            <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666;">
              <p>📧 We'll only email you when a slot becomes available</p>
              <p>If you have any questions, please contact us at ${businessSettings.business_phone}</p>
            </div>
          </div>
        `
      })

      if (error) {
        console.error('❌ [WAITLIST CONFIRMATION] Error sending email:', error)
        return false
      }

      console.log('✅ [WAITLIST CONFIRMATION] Email sent successfully!', { emailId: emailData?.id, to: data.customer.email })
      return true

    } catch (error) {
      console.error('❌ [WAITLIST CONFIRMATION] Exception in sendWaitlistConfirmationEmail:', error)
      return false
    }
  }

  // Send payment link email (hardcoded content; not from reminder_templates)
  async sendPaymentLinkEmail(paymentData: PaymentLinkData): Promise<boolean> {
    try {
      console.log('📧 [PAYMENT LINK EMAIL] Starting to send payment link email')

      // Check if Resend is configured
      if (!resend) {
        console.log('❌ [PAYMENT LINK EMAIL] Resend API key not configured')
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
        console.log('❌ [PAYMENT LINK EMAIL] Email notifications are disabled')
        return false
      }

      const tz = businessSettings.timezone
      const paymentDateObj = createBusinessDateTimeSync(paymentData.booking_date, '00:00:00', tz)
      const paymentDateTimeObj = createBusinessDateTimeSync(paymentData.booking_date, paymentData.booking_time, tz)
      const appointmentDate = paymentDateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: tz
      })

      const appointmentTime = paymentDateTimeObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: tz
      })

      const formattedPrice = (paymentData.price_charged / 100).toFixed(2)

      const subject = `Payment Request - ${paymentData.services.name} on ${appointmentDate}`
      const message = `Hi ${paymentData.customers.name},

Thank you for your recent appointment at ${businessSettings.business_name}!

Appointment Details:
• Service: ${paymentData.services.name}
• Date: ${appointmentDate}
• Time: ${appointmentTime}
• Amount Due: $${formattedPrice}

To complete your payment, please click the secure payment link below. You can pay with any major credit card or debit card.

Payment Link: ${paymentData.paymentUrl}

This payment link is secure and will take you to our payment processor where you can complete your transaction safely.

If you have any questions about this payment or your appointment, please contact us at appointments@dusthairstudio.com.

Thank you for choosing ${businessSettings.business_name}!

Best regards,
The ${businessSettings.business_name} Team`

      const { data: emailData, error } = await resend.emails.send({
        from: getResendFromAddress(),
        replyTo: businessSettings.business_email || undefined,
        to: [paymentData.customers.email],
        subject,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Payment Request - ${paymentData.services.name}</h2>
            
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <p style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 600;">
                💳 Payment Request
              </p>
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 15px 0;"><strong>Hi ${paymentData.customers.name},</strong></p>
              <p style="margin: 0 0 15px 0;">Thank you for your recent appointment at <strong>${businessSettings.business_name}</strong>!</p>
              
              <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <h3 style="margin: 0 0 10px 0; color: #333;">Appointment Details:</h3>
                <p style="margin: 5px 0;"><strong>Service:</strong> ${paymentData.services.name}</p>
                <p style="margin: 5px 0;"><strong>Date:</strong> ${appointmentDate}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${appointmentTime}</p>
                <p style="margin: 5px 0;"><strong>Amount Due:</strong> <span style="color: #059669; font-weight: bold; font-size: 18px;">$${formattedPrice}</span></p>
              </div>

              <p style="margin: 15px 0;">To complete your payment, please click the secure payment button below. You can pay with any major credit card or debit card.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${paymentData.paymentUrl}" style="display: inline-block; background-color: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                💳 Pay $${formattedPrice} Now
              </a>
            </div>

            <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                🔒 <strong>Secure Payment:</strong> This payment link is secure and will take you to our payment processor where you can complete your transaction safely.
              </p>
            </div>

            <div style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #666;">
              <p>If you have any questions about this payment or your appointment, please contact us at appointments@dusthairstudio.com.</p>
              <p>Thank you for choosing ${businessSettings.business_name}!</p>
              <p style="margin-top: 15px;"><strong>Booking ID:</strong> ${paymentData.id}</p>
            </div>
          </div>
        `
      })

      if (error) {
        console.error('❌ [PAYMENT LINK EMAIL] Error sending email:', error)
        return false
      }

      console.log('✅ [PAYMENT LINK EMAIL] Email sent successfully!', { emailId: emailData?.id, to: paymentData.customers.email })
      return true

    } catch (error) {
      console.error('❌ [PAYMENT LINK EMAIL] Exception in sendPaymentLinkEmail:', error)
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
      const insertData = {
        booking_id: bookingId,
        template_id: templateId,
        template_name: templateName,
        status,
        scheduled_for: new Date().toISOString(),
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        error_message: errorMessage,
        email_id: emailId
      }

      let { error } = await this.supabase
        .from('reminder_history')
        .insert(insertData)

      if (error && emailId && error.code === 'PGRST204' && error.message?.includes("'email_id'")) {
        const { email_id: _ignoredEmailId, ...insertDataWithoutEmailId } = insertData
        const retryResult = await this.supabase
          .from('reminder_history')
          .insert(insertDataWithoutEmailId)
        error = retryResult.error
      }

      if (error) {
        console.error('Error logging email send:', error)
      }
    } catch (error) {
      console.error('Error logging email send:', error)
    }
  }
}
