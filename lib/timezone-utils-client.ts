/**
 * Client-side timezone utilities for consistent date handling
 * These functions work in client components without server-side dependencies
 */

// Default timezone - will be overridden by settings
export const DEFAULT_BUSINESS_TIMEZONE = 'America/Los_Angeles'

/**
 * Creates a Date object in the specified timezone from date and time strings
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM:SS or HH:MM format
 * @param timezone - The timezone to use (defaults to Pacific)
 * @returns Date object representing the local time in the specified timezone
 */
export function createBusinessDateTime(dateString: string, timeString: string, timezone: string = DEFAULT_BUSINESS_TIMEZONE): Date {
  // Ensure time string has seconds if not provided
  const fullTimeString = timeString.includes(':') && timeString.split(':').length === 2 
    ? `${timeString}:00` 
    : timeString
  
  // Create date string in ISO format with proper timezone offset
  const isoString = `${dateString}T${fullTimeString}${getTimezoneOffsetString(timezone)}`
  
  return new Date(isoString)
}

/**
 * Helper function to get timezone offset string
 * @param timezone - The timezone identifier
 * @returns Offset string like "-08:00" or "-07:00"
 */
function getTimezoneOffsetString(timezone: string): string {
  // For now, use a simple mapping - this could be enhanced with a proper timezone library
  const timezoneOffsets: Record<string, string> = {
    'America/Los_Angeles': '-08:00', // PST, PDT is -07:00 but we'll handle that separately
    'America/New_York': '-05:00',    // EST, EDT is -04:00
    'America/Chicago': '-06:00',     // CST, CDT is -05:00
    'America/Denver': '-07:00',      // MST, MDT is -06:00
    'America/Phoenix': '-07:00',     // MST (no DST)
    'UTC': '+00:00'
  }
  
  return timezoneOffsets[timezone] || '-08:00'
}

/**
 * Converts a Date object to ISO string for Google Calendar API
 * @param date - Date object
 * @returns ISO string with timezone offset
 */
export function toCalendarISOString(date: Date): string {
  return date.toISOString()
}

/**
 * Formats a date for display in the specified timezone
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM:SS or HH:MM format
 * @param options - Intl.DateTimeFormat options
 * @param timezone - The timezone to use
 * @returns Formatted date string
 */
export function formatBusinessDateTime(
  dateString: string, 
  timeString: string, 
  options: Intl.DateTimeFormatOptions = {},
  timezone: string = DEFAULT_BUSINESS_TIMEZONE
): string {
  const date = createBusinessDateTime(dateString, timeString, timezone)
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options
  }
  
  return new Intl.DateTimeFormat('en-US', defaultOptions).format(date)
}

/**
 * Gets the current time in the specified timezone
 * @param timezone - The timezone to use
 * @returns Date object in the specified timezone
 */
export function getCurrentBusinessTime(timezone: string = DEFAULT_BUSINESS_TIMEZONE): Date {
  // Create a date object representing the current time in the specified timezone
  const now = new Date()
  
  // Use Intl.DateTimeFormat to get the time in the specified timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  const parts = formatter.formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value
  const month = parts.find(p => p.type === 'month')?.value
  const day = parts.find(p => p.type === 'day')?.value
  const hour = parts.find(p => p.type === 'hour')?.value
  const minute = parts.find(p => p.type === 'minute')?.value
  const second = parts.find(p => p.type === 'second')?.value
  
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`)
}

/**
 * Calculates end time for an appointment
 * @param startDate - Start date
 * @param startTime - Start time
 * @param durationMinutes - Duration in minutes
 * @param timezone - The timezone to use
 * @returns End Date object in the specified timezone
 */
export function calculateEndTime(
  startDate: string, 
  startTime: string, 
  durationMinutes: number,
  timezone: string = DEFAULT_BUSINESS_TIMEZONE
): Date {
  const startDateTime = createBusinessDateTime(startDate, startTime, timezone)
  return new Date(startDateTime.getTime() + durationMinutes * 60000)
}

/**
 * Validates if a date/time is in the future
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM:SS or HH:MM format
 * @param timezone - The timezone to use
 * @returns true if the appointment is in the future
 */
export function isFutureAppointment(dateString: string, timeString: string, timezone: string = DEFAULT_BUSINESS_TIMEZONE): boolean {
  const appointmentTime = createBusinessDateTime(dateString, timeString, timezone)
  const now = getCurrentBusinessTime(timezone)
  return appointmentTime > now
}
