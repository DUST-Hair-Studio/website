import { NextResponse } from 'next/server'
import { GoogleCalendarService } from '@/lib/google-calendar'

// Check if Google Calendar connection is actually working (not just the flag)
export async function GET() {
  try {
    const googleCalendar = new GoogleCalendarService()
    const result = await googleCalendar.verifyConnection()
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Google Calendar health check error:', error)
    return NextResponse.json({ 
      connected: false, 
      healthy: false,
      error: 'Health check failed'
    })
  }
}
