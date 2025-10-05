import { createAdminSupabaseClient } from './supabase-server'

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

      const startDateTime = new Date(`${booking.booking_date}T${booking.booking_time}`)
      const endDateTime = new Date(startDateTime.getTime() + booking.services.duration_minutes * 60000)

      const event: GoogleCalendarEvent = {
        id: '', // Google will assign this
        summary: `${booking.services.name} - ${booking.customers.name}`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'America/Los_Angeles'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'America/Los_Angeles'
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
      if (!accessToken) return []

      const { data: calendarData } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_calendar_id')
        .single()

      const calendarId = calendarData?.value
      if (!calendarId) return []

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

      if (!response.ok) return []

      const data = await response.json()
      const blockedSlots: Array<{ date: string; start_time: string; end_time: string }> = []

      // Filter out events that are not from our booking system
      const externalEvents = data.items?.filter((event: { description?: string; status?: string }) => 
        !event.description?.includes('Booking ID:') && 
        event.status !== 'cancelled'
      ) || []

      for (const event of externalEvents) {
        const startDateTime = new Date(event.start.dateTime || event.start.date)
        const endDateTime = new Date(event.end.dateTime || event.end.date)
        
        blockedSlots.push({
          date: startDateTime.toISOString().split('T')[0],
          start_time: startDateTime.toTimeString().slice(0, 5),
          end_time: endDateTime.toTimeString().slice(0, 5)
        })
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
