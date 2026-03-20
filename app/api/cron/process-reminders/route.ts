import { NextRequest, NextResponse } from 'next/server'
import { runProcessReminders } from '@/lib/process-reminders'

/**
 * Vercel cron: processes pending appointment reminders that are due.
 * Can also be triggered by external cron (e.g. cron-job.org) for hourly runs on free tier.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (process.env.CRON_SECRET) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const result = await runProcessReminders()
    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} reminders`,
      ...result
    })
  } catch (error) {
    console.error('Cron process-reminders error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
