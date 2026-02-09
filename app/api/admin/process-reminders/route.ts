import { NextResponse } from 'next/server'
import { runProcessReminders } from '@/lib/process-reminders'

// This endpoint processes pending reminders that are due to be sent
// Can be called manually (POST) or by the Vercel cron via /api/cron/process-reminders
export async function POST() {
  try {
    const result = await runProcessReminders()
    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} reminders`,
      ...result
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
