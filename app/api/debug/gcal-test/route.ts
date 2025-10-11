import { NextRequest, NextResponse } from 'next/server'
import { GoogleCalendarService } from '@/lib/google-calendar'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

/**
 * Comprehensive Google Calendar integration test endpoint
 * Tests connection, token refresh, and event fetching
 */
export async function GET(request: NextRequest) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    connection: {
      isConnected: false,
      hasAccessToken: false,
      hasRefreshToken: false,
      hasCalendarId: false,
      tokenExpiry: null as string | null
    },
    settings: {} as Record<string, any>,
    testFetch: {
      success: false,
      eventCount: 0,
      blockedSlotCount: 0,
      error: null as string | null,
      rawEvents: [] as any[],
      blockedSlots: [] as any[]
    }
  }

  try {
    const supabase = createAdminSupabaseClient()
    
    // Check all relevant settings
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'google_calendar_connected',
        'google_calendar_id',
        'google_access_token',
        'google_refresh_token',
        'google_token_expires_at',
        'business_timezone'
      ])
    
    if (settings) {
      settings.forEach(s => {
        // Mask sensitive values
        if (s.key.includes('token') && s.key !== 'google_token_expires_at') {
          diagnostics.settings[s.key] = s.value ? `${s.value.substring(0, 20)}...` : null
        } else {
          diagnostics.settings[s.key] = s.value
        }
      })
      
      // Set connection flags
      diagnostics.connection.isConnected = !!diagnostics.settings.google_calendar_connected
      diagnostics.connection.hasAccessToken = !!diagnostics.settings.google_access_token
      diagnostics.connection.hasRefreshToken = !!diagnostics.settings.google_refresh_token
      diagnostics.connection.hasCalendarId = !!diagnostics.settings.google_calendar_id
      
      if (diagnostics.settings.google_token_expires_at) {
        const expiryDate = new Date(diagnostics.settings.google_token_expires_at)
        diagnostics.connection.tokenExpiry = expiryDate.toISOString()
        
        // Check if token is expired or expiring soon
        const now = Date.now()
        const timeUntilExpiry = diagnostics.settings.google_token_expires_at - now
        const hoursUntilExpiry = timeUntilExpiry / (1000 * 60 * 60)
        
        diagnostics.connection['tokenStatus'] = 
          hoursUntilExpiry < 0 ? 'EXPIRED' :
          hoursUntilExpiry < 1 ? 'EXPIRING_SOON' :
          'VALID'
        
        diagnostics.connection['hoursUntilExpiry'] = Math.round(hoursUntilExpiry * 10) / 10
      }
    }
    
    // Test fetching events
    if (diagnostics.connection.isConnected) {
      try {
        const googleCalendar = new GoogleCalendarService()
        const { searchParams } = new URL(request.url)
        
        // Default to checking today and next 7 days
        const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0]
        const endDate = searchParams.get('endDate') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        
        console.log('🧪 GCAL TEST: Fetching blocked time for', startDate, 'to', endDate)
        
        const blockedSlots = await googleCalendar.getBlockedTime(startDate, endDate)
        
        diagnostics.testFetch.success = true
        diagnostics.testFetch.blockedSlotCount = blockedSlots.length
        diagnostics.testFetch.blockedSlots = blockedSlots
        
        console.log('🧪 GCAL TEST: Successfully fetched', blockedSlots.length, 'blocked slots')
      } catch (error) {
        diagnostics.testFetch.error = error instanceof Error ? error.message : 'Unknown error'
        console.error('🧪 GCAL TEST: Error fetching events:', error)
      }
    } else {
      diagnostics.testFetch.error = 'Google Calendar not connected'
    }
    
    return NextResponse.json(diagnostics, { status: 200 })
  } catch (error) {
    console.error('🧪 GCAL TEST: Fatal error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      diagnostics
    }, { status: 500 })
  }
}

