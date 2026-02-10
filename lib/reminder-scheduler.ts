import { createAdminSupabaseClient } from './supabase-server'
import { createBusinessDateTimeSync } from './timezone-utils'

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

export class ReminderScheduler {
  private supabase = createAdminSupabaseClient()

  // Schedule all active reminder templates for a booking
  async scheduleRemindersForBooking(booking: BookingData): Promise<void> {
    try {
      // Get all active reminder templates
      const { data: templates, error: templatesError } = await this.supabase
        .from('reminder_templates')
        .select('*')
        .eq('is_active', true)
        .order('hours_before', { ascending: false })

      if (templatesError) {
        console.error('Error fetching reminder templates:', templatesError)
        return
      }

      if (!templates || templates.length === 0) {
        console.log('No active reminder templates found')
        return
      }

      // Appointment time is stored as business-timezone local; interpret it in that zone (not server UTC)
      const { data: tzRow } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'business_timezone')
        .single()
      const timezone = (tzRow?.value as string) || 'America/Los_Angeles'
      const appointmentDateTime = createBusinessDateTimeSync(booking.booking_date, booking.booking_time, timezone)

      // Schedule each template
      for (const template of templates) {
        await this.scheduleReminder(booking, template, appointmentDateTime)
      }

      console.log(`Scheduled ${templates.length} reminders for booking ${booking.id}`)

    } catch (error) {
      console.error('Error scheduling reminders for booking:', error)
    }
  }

  // Schedule a specific reminder template for a booking
  private async scheduleReminder(
    booking: BookingData, 
    template: { id: string; name: string; type: string; hours_before: number }, 
    appointmentDateTime: Date
  ): Promise<void> {
    try {
      let scheduledFor: Date

      if (template.type === 'confirmation') {
        // Confirmation emails are sent immediately
        scheduledFor = new Date()
      } else if (template.type === 'followup') {
        // Follow-up emails are sent after the appointment
        scheduledFor = new Date(appointmentDateTime.getTime() + (booking.duration_minutes * 60 * 1000))
      } else {
        // Reminder emails are sent X hours before the appointment
        const hoursBefore = template.hours_before || 24
        scheduledFor = new Date(appointmentDateTime.getTime() - (hoursBefore * 60 * 60 * 1000))
      }

      // Don't schedule reminders for past appointments (except follow-ups)
      if (template.type !== 'followup' && scheduledFor < new Date()) {
        console.log(`Skipping ${template.name} for booking ${booking.id} - scheduled time is in the past`)
        return
      }

      // Insert reminder into history
      const { error: insertError } = await this.supabase
        .from('reminder_history')
        .insert({
          booking_id: booking.id,
          template_id: template.id,
          template_name: template.name,
          status: 'pending',
          scheduled_for: scheduledFor.toISOString()
        })

      if (insertError) {
        console.error(`Error scheduling reminder ${template.name} for booking ${booking.id}:`, insertError)
      } else {
        console.log(`Scheduled ${template.name} for booking ${booking.id} at ${scheduledFor.toISOString()}`)
      }

    } catch (error) {
      console.error(`Error scheduling reminder ${template.name}:`, error)
    }
  }

  // Cancel all pending reminders for a booking (when booking is cancelled)
  async cancelRemindersForBooking(bookingId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('reminder_history')
        .update({ 
          status: 'failed',
          error_message: 'Booking was cancelled',
          sent_at: new Date().toISOString()
        })
        .eq('booking_id', bookingId)
        .eq('status', 'pending')

      if (error) {
        console.error(`Error cancelling reminders for booking ${bookingId}:`, error)
      } else {
        console.log(`Cancelled pending reminders for booking ${bookingId}`)
      }
    } catch (error) {
      console.error(`Error cancelling reminders for booking ${bookingId}:`, error)
    }
  }
}