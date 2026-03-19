import { createAdminSupabaseClient } from './supabase-server'
import { EmailService } from './email-service'

export interface ProcessRemindersResult {
  processed: number
  successful: number
  failed: number
}

const MAX_RETRY_AGE_HOURS = 24
const SEND_DELAY_MS = 600

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Process all pending reminders that are due to be sent.
 * Used by both the admin POST endpoint and the Vercel cron GET endpoint.
 */
export async function runProcessReminders(): Promise<ProcessRemindersResult> {
  const supabase = createAdminSupabaseClient()
  const emailService = new EmailService()

  const nowDate = new Date()
  const nowIso = nowDate.toISOString()
  const staleCutoffIso = new Date(nowDate.getTime() - (MAX_RETRY_AGE_HOURS * 60 * 60 * 1000)).toISOString()

  // Mark stale pending reminders as failed so they cannot be retried forever.
  const { error: staleReminderError } = await supabase
    .from('reminder_history')
    .update({
      status: 'failed',
      error_message: `Skipped by cron: reminder older than ${MAX_RETRY_AGE_HOURS} hours`,
      sent_at: nowIso
    })
    .eq('status', 'pending')
    .lte('scheduled_for', staleCutoffIso)

  if (staleReminderError) {
    console.error('Error expiring stale pending reminders:', staleReminderError)
  }

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
    .gt('scheduled_for', staleCutoffIso)
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
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

  for (let i = 0; i < pendingReminders.length; i++) {
    const reminder = pendingReminders[i]
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

      const customers = reminder.bookings?.customers
      const customerEmail = customers?.email
      if (!customerEmail || typeof customerEmail !== 'string') {
        await supabase
          .from('reminder_history')
          .update({ status: 'failed', error_message: 'No customer email', sent_at: new Date().toISOString() })
          .eq('id', reminder.id)
        failed++
        continue
      }

      const bookingData = {
        id: reminder.bookings.id,
        booking_date: reminder.bookings.booking_date,
        booking_time: reminder.bookings.booking_time,
        duration_minutes: reminder.bookings.duration_minutes,
        price_charged: reminder.bookings.price_charged,
        services: {
          name: reminder.bookings.services?.name ?? '',
          duration_minutes: reminder.bookings.services?.duration_minutes ?? 0
        },
        customers: {
          name: customers?.name ?? '',
          email: customerEmail,
          phone: customers?.phone ?? ''
        }
      }

      const emailSent = await emailService.sendReminderEmail(
        bookingData,
        reminder.template_id || '',
        reminder.id
      )

      if (emailSent) {
        successful++
        console.log(`Reminder sent successfully for booking ${reminder.booking_id}`)
      } else {
        failed++
        await supabase
          .from('reminder_history')
          .update({
            status: 'failed',
            error_message: 'Email send failed',
            sent_at: new Date().toISOString()
          })
          .eq('id', reminder.id)
          .eq('status', 'pending')
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

    // Pace provider requests to stay under Resend's per-second limits.
    if (i < pendingReminders.length - 1) {
      await sleep(SEND_DELAY_MS)
    }
  }

  return { processed, successful, failed }
}
