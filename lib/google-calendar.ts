import { createAdminSupabaseClient } from './supabase-server'
import { createBusinessDateTime, calculateEndTime, toCalendarISOString, BUSINESS_TIMEZONE } from './timezone-utils'

interface GoogleCalendarEvent {
  id: string
  summary: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  description?: string
}

interface BookingData {
  id: string
  customer_id: string
  service_id: string
  booking_date: string
  booking_time: string
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

export class GoogleCalendarService {
  private supabase = createAdminSupabaseClient()

  // Get access token from database
  private async getAccessToken(): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_access_token')
        .single()

      if (error || !data) return null

      // Check if token is expired and refresh if needed
      const token = await this.refreshTokenIfNeeded(data.value)
      return token
    } catch (error) {
      console.error('Error getting access token:', error)
      return null
    }
  }

  // Refresh access token if needed
  private async refreshTokenIfNeeded(accessToken: string): Promise<string> {
    try {
      const { data: expiresData } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_token_expires_at')
        .single()

      const expiresAt = expiresData?.value || 0
      
      // If token expires in less than 5 minutes, refresh it
      if (Date.now() >= expiresAt - 300000) {
        const { data: refreshTokenData } = await this.supabase
          .from('settings')
          .select('value')
          .eq('key', 'google_refresh_token')
          .single()

        if (!refreshTokenData) return accessToken

        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: refreshTokenData.value,
            grant_type: 'refresh_token'
          })
        })

        const tokenData = await response.json()

        if (response.ok) {
          // Update tokens in database
          await this.supabase
            .from('settings')
            .upsert({ key: 'google_access_token', value: tokenData.access_token })
          
          await this.supabase
            .from('settings')
            .upsert({ 
              key: 'google_token_expires_at', 
              value: Date.now() + (tokenData.expires_in * 1000) 
            })

          return tokenData.access_token
        }
      }

      return accessToken
    } catch (error) {
      console.error('Error refreshing token:', error)
      return accessToken
    }
  }

  // Create calendar event for booking
  async createBookingEvent(booking: BookingData): Promise<string | null> {
    try {
      const accessToken = await this.getAccessToken()
      if (!accessToken) return null

      const { data: calendarData } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_calendar_id')
        .single()

      const calendarId = calendarData?.value
      if (!calendarId) return null

      // Create dates using timezone utilities for consistent handling
      const startDateTime = createBusinessDateTime(booking.booking_date, booking.booking_time)
      const endDateTime = calculateEndTime(booking.booking_date, booking.booking_time, booking.services.duration_minutes)

      const event: GoogleCalendarEvent = {
        id: '', // Google will assign this
        summary: `${booking.services.name} - ${booking.customers.name}`,
        start: {
          dateTime: toCalendarISOString(startDateTime),
          timeZone: BUSINESS_TIMEZONE
        },
        end: {
          dateTime: toCalendarISOString(endDateTime),
          timeZone: BUSINESS_TIMEZONE
        },
        description: `Customer: ${booking.customers.name}
Email: ${booking.customers.email}
Phone: ${booking.customers.phone}
Service: ${booking.services.name}
Duration: ${booking.services.duration_minutes} minutes

Booking ID: ${booking.id}`
      }

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      })

      if (!response.ok) {
        console.error('Error creating calendar event:', await response.text())
        return null
      }

      const createdEvent = await response.json()
      
      // Update booking with Google Calendar event ID
      await this.supabase
        .from('bookings')
        .update({ google_calendar_event_id: createdEvent.id })
        .eq('id', booking.id)

      return createdEvent.id
    } catch (error) {
      console.error('Error creating booking event:', error)
      return null
    }
  }

  // Update calendar event for booking
  async updateBookingEvent(eventId: string, updates: { start: Date; end: Date }): Promise<boolean> {
    try {
      console.log('🔄 GoogleCalendarService: Starting event update for', eventId)
      console.log('🔄 GoogleCalendarService: Update details:', {
        eventId,
        startTime: updates.start.toISOString(),
        endTime: updates.end.toISOString(),
        startTimeLocal: updates.start.toString(),
        endTimeLocal: updates.end.toString()
      })
      
      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        console.log('❌ GoogleCalendarService: No access token available')
        return false
      }
      console.log('✅ GoogleCalendarService: Access token obtained')
      console.log('🔍 Access token details:', {
        hasToken: !!accessToken,
        tokenLength: accessToken?.length,
        tokenPrefix: accessToken?.substring(0, 20) + '...'
      })

      const { data: calendarData } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_calendar_id')
        .single()

      const calendarId = calendarData?.value
      if (!calendarId) {
        console.log('❌ GoogleCalendarService: No calendar ID found')
        return false
      }
      console.log('✅ GoogleCalendarService: Calendar ID found:', calendarId)

      // Get current event details first
      console.log('🔄 GoogleCalendarService: Fetching current event details...')
      const getResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!getResponse.ok) {
        console.log('❌ GoogleCalendarService: Failed to fetch current event:', getResponse.status, getResponse.statusText)
        return false
      }
      const currentEvent = await getResponse.json()
      console.log('✅ GoogleCalendarService: Current event fetched successfully')
      console.log('🔍 Current event structure:', {
        id: currentEvent.id,
        summary: currentEvent.summary,
        start: currentEvent.start,
        end: currentEvent.end,
        hasStart: !!currentEvent.start,
        hasEnd: !!currentEvent.end
      })

      // Update the event with new start/end times using timezone utilities
      const updatedEvent = {
        start: {
          dateTime: toCalendarISOString(updates.start),
          timeZone: BUSINESS_TIMEZONE
        },
        end: {
          dateTime: toCalendarISOString(updates.end),
          timeZone: BUSINESS_TIMEZONE
        }
      }

      console.log('🔄 GoogleCalendarService: Sending PATCH update request...', {
        startTime: updates.start.toISOString(),
        endTime: updates.end.toISOString()
      })
      console.log('🔍 Updated event structure (PATCH body):', {
        start: updatedEvent.start,
        end: updatedEvent.end
      })
      console.log('🔍 Full PATCH request body:', JSON.stringify(updatedEvent, null, 2))

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedEvent)
      })

      if (response.ok) {
        const updatedEventResponse = await response.json()
        console.log('✅ GoogleCalendarService: Event updated successfully')
        console.log('🔍 Updated event response:', {
          id: updatedEventResponse.id,
          summary: updatedEventResponse.summary,
          start: updatedEventResponse.start,
          end: updatedEventResponse.end,
          updated: updatedEventResponse.updated
        })
        return true
      } else {
        console.log('❌ GoogleCalendarService: Failed to update event:', response.status, response.statusText)
        const errorText = await response.text()
        console.log('❌ GoogleCalendarService: Error details:', errorText)
        console.log('❌ GoogleCalendarService: Request details:', {
          url: `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`,
          method: 'PATCH',
          hasAuth: !!accessToken,
          calendarId,
          eventId
        })
        return false
      }
    } catch (error) {
      console.error('Error updating Google Calendar event:', error)
      return false
    }
  }

  // Delete calendar event for booking
  async deleteBookingEvent(bookingId: string, eventId: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken()
      if (!accessToken) return false

      const { data: calendarData } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_calendar_id')
        .single()

      const calendarId = calendarData?.value
      if (!calendarId) return false

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        // Remove Google Calendar event ID from booking
        await this.supabase
          .from('bookings')
          .update({ google_calendar_event_id: null })
          .eq('id', bookingId)
      }

      return response.ok
    } catch (error) {
      console.error('Error deleting booking event:', error)
      return false
    }
  }

  // Get blocked time from Google Calendar
  async getBlockedTime(startDate: string, endDate: string): Promise<Array<{ date: string; start_time: string; end_time: string }>> {
    try {
      const accessToken = await this.getAccessToken()
      if (!accessToken) {
        console.log('No Google Calendar access token available')
        return []
      }

      const { data: calendarData } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_calendar_id')
        .single()

      const calendarId = calendarData?.value
      if (!calendarId) {
        console.log('No Google Calendar ID configured')
        return []
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?` +
        `timeMin=${startDate}T00:00:00-08:00&timeMax=${endDate}T23:59:59-08:00&` +
        `singleEvents=true&orderBy=startTime`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        console.error('Google Calendar API error:', response.status, await response.text())
        return []
      }

      const data = await response.json()
      const blockedSlots: Array<{ date: string; start_time: string; end_time: string }> = []

      // Filter out events that are not from our booking system
      const externalEvents = data.items?.filter((event: { description?: string; status?: string; summary?: string }) => {
        const isExternal = !event.description?.includes('Booking ID:') && 
                           event.status !== 'cancelled'
        return isExternal
      }) || []

      for (const event of externalEvents) {
        const startDateTime = new Date(event.start.dateTime || event.start.date)
        const endDateTime = new Date(event.end.dateTime || event.end.date)
        
        // Convert to Pacific timezone for consistency
        const pacificStart = new Date(startDateTime.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
        const pacificEnd = new Date(endDateTime.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}))
        
        // Format date as YYYY-MM-DD in Pacific timezone
        const year = pacificStart.getFullYear()
        const month = String(pacificStart.getMonth() + 1).padStart(2, '0')
        const day = String(pacificStart.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        
        // Format time as HH:MM in Pacific timezone
        const startTime = pacificStart.toTimeString().slice(0, 5)
        const endTime = pacificEnd.toTimeString().slice(0, 5)
        
        const blockedSlot = {
          date: dateStr,
          start_time: startTime,
          end_time: endTime
        }
        
        blockedSlots.push(blockedSlot)
      }

      return blockedSlots
    } catch (error) {
      console.error('Error getting blocked time:', error)
      return []
    }
  }

  // Check if Google Calendar is connected
  async isConnected(): Promise<boolean> {
    try {
      const { data } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_calendar_connected')
        .single()

      return Boolean(data?.value)
    } catch {
      return false
    }
  }
}
