import { createAdminSupabaseClient } from './supabase-server'
import { EmailService } from './email-service'

export interface ProcessRemindersResult {
  processed: number
  successful: number
  failed: number
}

/**
 * Process all pending reminders that are due to be sent.
 * Used by both the admin POST endpoint and the Vercel cron GET endpoint.
 */
export async function runProcessReminders(): Promise<ProcessRemindersResult> {
  const supabase = createAdminSupabaseClient()
  const emailService = new EmailService()

  const now = new Date().toISOString()

  const { data: pendingReminders, error: remindersError } = await supabase
    .from('reminder_history')
    .select(`
      *,
      bookings!inner(
        id,
        customer_id,
        booking_date,
        booking_time,
        duration_minutes,
        status,
        services!inner(
          name,
          duration_minutes
        ),
        customers!inner(
          name,
          email,
          phone
        )
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(50)

  if (remindersError) {
    console.error('Error fetching pending reminders:', remindersError)
    throw new Error(remindersError.message)
  }

  let processed = 0
  let successful = 0
  let failed = 0

  if (!pendingReminders || pendingReminders.length === 0) {
    return { processed: 0, successful: 0, failed: 0 }
  }

  for (const reminder of pendingReminders) {
    try {
      processed++

      if (reminder.bookings.status === 'cancelled') {
        await supabase
          .from('reminder_history')
          .update({
            status: 'failed',
            error_message: 'Booking was cancelled',
            sent_at: new Date().toISOString()
          })
          .eq('id', reminder.id)
        continue
      }

      const bookingData = {
        id: reminder.bookings.id,
        booking_date: reminder.bookings.booking_date,
        booking_time: reminder.bookings.booking_time,
        duration_minutes: reminder.bookings.duration_minutes,
        price_charged: reminder.bookings.price_charged,
        services: {
          name: reminder.bookings.services.name,
          duration_minutes: reminder.bookings.services.duration_minutes
        },
        customers: {
          name: reminder.bookings.customers.name,
          email: reminder.bookings.customers.email,
          phone: reminder.bookings.customers.phone
        }
      }

      const emailSent = await emailService.sendReminderEmail(bookingData, reminder.template_id || '')

      if (emailSent) {
        successful++
        await supabase
          .from('reminder_history')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', reminder.id)
        console.log(`Reminder sent successfully for booking ${reminder.booking_id}`)
      } else {
        failed++
        console.log(`Failed to send reminder for booking ${reminder.booking_id}`)
      }
    } catch (error) {
      failed++
      console.error(`Error processing reminder ${reminder.id}:`, error)
      await supabase
        .from('reminder_history')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          sent_at: new Date().toISOString()
        })
        .eq('id', reminder.id)
    }
  }

  return { processed, successful, failed }
}
