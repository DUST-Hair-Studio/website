import { createAdminSupabaseClient } from './supabase-server'
import { createBusinessDateTime, calculateEndTime, toCalendarISOString, getBusinessTimezone } from './timezone-utils'

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

      // Get the configured business timezone
      const businessTimezone = await getBusinessTimezone()
      
      // Create dates using timezone utilities for consistent handling
      const startDateTime = await createBusinessDateTime(booking.booking_date, booking.booking_time, businessTimezone)
      const endDateTime = await calculateEndTime(booking.booking_date, booking.booking_time, booking.services.duration_minutes, businessTimezone)

      const event: GoogleCalendarEvent = {
        id: '', // Google will assign this
        summary: `${booking.services.name} - ${booking.customers.name}`,
        start: {
          dateTime: toCalendarISOString(startDateTime),
          timeZone: businessTimezone
        },
        end: {
          dateTime: toCalendarISOString(endDateTime),
          timeZone: businessTimezone
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

      // Get the configured business timezone
      const businessTimezone = await getBusinessTimezone()
      
      // Update the event with new start/end times using timezone utilities
      const updatedEvent = {
        start: {
          dateTime: toCalendarISOString(updates.start),
          timeZone: businessTimezone
        },
        end: {
          dateTime: toCalendarISOString(updates.end),
          timeZone: businessTimezone
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
        console.log('🔴 No Google Calendar access token available')
        return []
      }

      const { data: calendarData } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', 'google_calendar_id')
        .single()

      const calendarId = calendarData?.value
      if (!calendarId) {
        console.log('🔴 No Google Calendar ID configured')
        return []
      }

      // Get business timezone
      const businessTimezone = await getBusinessTimezone()
      
      // Create proper ISO strings for the API call with timezone
      const timeMin = `${startDate}T00:00:00`
      const timeMax = `${endDate}T23:59:59`
      
      console.log('🔍 Fetching Google Calendar events:', { 
        calendarId, 
        timeMin, 
        timeMax,
        timezone: businessTimezone
      })

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
        `timeMin=${timeMin}Z&timeMax=${timeMax}Z&` +
        `timeZone=${businessTimezone}&` +
        `singleEvents=true&orderBy=startTime`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('🔴 Google Calendar API error:', response.status, errorText)
        return []
      }

      const data = await response.json()
      console.log('✅ Google Calendar API response:', {
        totalEvents: data.items?.length || 0
      })
      
      const blockedSlots: Array<{ date: string; start_time: string; end_time: string }> = []

      // Filter out events that are not from our booking system
      const externalEvents = data.items?.filter((event: { description?: string; status?: string; summary?: string }) => {
        const isExternal = !event.description?.includes('Booking ID:') && 
                           event.status !== 'cancelled'
        return isExternal
      }) || []

      console.log('🔍 External events found (excluding our bookings):', externalEvents.length)

      for (const event of externalEvents) {
        console.log('🔍 Processing event:', {
          summary: event.summary,
          start: event.start,
          end: event.end
        })
        
        // Handle all-day events differently
        if (event.start.date && !event.start.dateTime) {
          // All-day event - block the entire business day
          const startDate = event.start.date // Already in YYYY-MM-DD format
          const endDate = event.end?.date // End date is exclusive in Google Calendar
          
          console.log('📅 All-day event detected:', {
            start: startDate,
            end: endDate,
            summary: event.summary
          })
          
          // Handle multi-day all-day events
          if (endDate && endDate !== startDate) {
            // Multi-day event - block all days from start to end (end is exclusive)
            const currentDate = new Date(startDate + 'T00:00:00')
            const lastDate = new Date(endDate + 'T00:00:00')
            
            console.log('📅 Multi-day all-day event - blocking range:', {
              from: startDate,
              to: endDate,
              summary: event.summary
            })
            
            while (currentDate < lastDate) {
              const dateStr = currentDate.toISOString().split('T')[0]
              blockedSlots.push({
                date: dateStr,
                start_time: '00:00',
                end_time: '23:59'
              })
              currentDate.setDate(currentDate.getDate() + 1)
            }
          } else {
            // Single day all-day event
            blockedSlots.push({
              date: startDate,
              start_time: '00:00',
              end_time: '23:59'
            })
          }
        } else {
          // Regular timed event
          const startDateTime = new Date(event.start.dateTime)
          const endDateTime = new Date(event.end.dateTime)
          
          console.log('🔍 Raw Google Calendar event times (UTC):', {
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString()
          })
          
          // Use Intl.DateTimeFormat to properly convert timezone
          // This is the CORRECT way to handle timezones
          const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: businessTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })
          
          const startParts = formatter.formatToParts(startDateTime)
          const endParts = formatter.formatToParts(endDateTime)
          
          const getPartValue = (parts: Intl.DateTimeFormatPart[], type: string) => 
            parts.find(p => p.type === type)?.value || '00'
          
          // Extract date components for start time
          const startYear = getPartValue(startParts, 'year')
          const startMonth = getPartValue(startParts, 'month')
          const startDay = getPartValue(startParts, 'day')
          const startHour = getPartValue(startParts, 'hour')
          const startMinute = getPartValue(startParts, 'minute')
          
          // Extract date components for end time (might be different day if spans midnight)
          const endYear = getPartValue(endParts, 'year')
          const endMonth = getPartValue(endParts, 'month')
          const endDay = getPartValue(endParts, 'day')
          const endHour = getPartValue(endParts, 'hour')
          const endMinute = getPartValue(endParts, 'minute')
          
          const startDateStr = `${startYear}-${startMonth}-${startDay}`
          const endDateStr = `${endYear}-${endMonth}-${endDay}`
          const startTime = `${startHour}:${startMinute}`
          const endTime = `${endHour}:${endMinute}`
          
          console.log('⏰ Timed event converted to', businessTimezone + ':', {
            startDate: startDateStr,
            endDate: endDateStr,
            startTime,
            endTime,
            originalStartUTC: startDateTime.toISOString(),
            originalEndUTC: endDateTime.toISOString()
          })
          
          // Check if event spans midnight
          if (startDateStr !== endDateStr) {
            // Event spans multiple days - split into separate blocked slots
            console.log('🌙 Event spans midnight - splitting into multiple slots')
            
            // Block from start time to end of start day
            blockedSlots.push({
              date: startDateStr,
              start_time: startTime,
              end_time: '23:59'
            })
            
            // If there are full days in between, block them entirely
            const startDateObj = new Date(`${startDateStr}T00:00:00`)
            const endDateObj = new Date(`${endDateStr}T00:00:00`)
            const daysDiff = Math.floor((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24))
            
            for (let i = 1; i < daysDiff; i++) {
              const middleDate = new Date(startDateObj)
              middleDate.setDate(middleDate.getDate() + i)
              const middleDateStr = middleDate.toISOString().split('T')[0]
              blockedSlots.push({
                date: middleDateStr,
                start_time: '00:00',
                end_time: '23:59'
              })
            }
            
            // Block from start of end day to end time
            blockedSlots.push({
              date: endDateStr,
              start_time: '00:00',
              end_time: endTime
            })
            
            console.log(`✅ Created ${1 + (daysDiff - 1) + 1} blocked slots for multi-day event`)
          } else {
            // Same day event
            blockedSlots.push({
              date: startDateStr,
              start_time: startTime,
              end_time: endTime
            })
          }
        }
      }

      console.log('✅ Total blocked slots created:', blockedSlots.length, blockedSlots)
      return blockedSlots
    } catch (error) {
      console.error('🔴 Error getting blocked time:', error)
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
