import { NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { EmailService } from '@/lib/email-service'

// This endpoint processes pending reminders that are due to be sent
// Can be called manually or by a cron job
export async function POST() {
  try {
    const supabase = createAdminSupabaseClient()
    const emailService = new EmailService()

    // Get all pending reminders that are due to be sent
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
      .limit(50) // Process in batches

    if (remindersError) {
      console.error('Error fetching pending reminders:', remindersError)
      return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No pending reminders to process',
        processed: 0
      })
    }

    let processed = 0
    let successful = 0
    let failed = 0

    // Process each reminder
    for (const reminder of pendingReminders) {
      try {
        processed++
        
        // Skip if booking is cancelled
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

        // Prepare booking data for email service
        const bookingData = {
          id: reminder.bookings.id,
          booking_date: reminder.bookings.booking_date,
          booking_time: reminder.bookings.booking_time,
          duration_minutes: reminder.bookings.duration_minutes,
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

        // Send the reminder email
        const emailSent = await emailService.sendReminderEmail(bookingData, reminder.template_id || '')

        if (emailSent) {
          successful++
          console.log(`Reminder sent successfully for booking ${reminder.booking_id}`)
        } else {
          failed++
          console.log(`Failed to send reminder for booking ${reminder.booking_id}`)
        }

      } catch (error) {
        failed++
        console.error(`Error processing reminder ${reminder.id}:`, error)
        
        // Update reminder status to failed
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

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} reminders`,
      processed,
      successful,
      failed
    })

  } catch (error) {
    console.error('Process reminders error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint for health check
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy',
    message: 'Reminder processing endpoint is running',
    timestamp: new Date().toISOString()
  })
}
