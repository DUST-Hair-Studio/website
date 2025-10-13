/**
 * Timezone utilities for consistent date handling across the application
 * This prevents the recurring timezone issues by centralizing all date operations
 */

// Default timezone - will be overridden by database setting
export const DEFAULT_BUSINESS_TIMEZONE = 'America/Los_Angeles'

/**
 * Gets the configured business timezone from the database (server-side only)
 * @returns Promise<string> - The business timezone
 */
export async function getBusinessTimezone(): Promise<string> {
  try {
    // Dynamic import to avoid server-side code in client components
    const { createAdminSupabaseClient } = await import('./supabase-server')
    const supabase = createAdminSupabaseClient()
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'business_timezone')
      .single()
    
    return data?.value || DEFAULT_BUSINESS_TIMEZONE
  } catch (error) {
    console.error('Error fetching business timezone:', error)
    return DEFAULT_BUSINESS_TIMEZONE
  }
}

/**
 * Creates a Date object in the business timezone from date and time strings
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM:SS or HH:MM format
 * @param timezone - Optional timezone override (defaults to configured business timezone)
 * @returns Date object representing the local time in business timezone
 */
export async function createBusinessDateTime(dateString: string, timeString: string, timezone?: string): Promise<Date> {
  // Ensure time string has seconds if not provided
  const fullTimeString = timeString.includes(':') && timeString.split(':').length === 2 
    ? `${timeString}:00` 
    : timeString
  
  // Get the business timezone
  const businessTimezone = timezone || await getBusinessTimezone()
  
  // Create a date object to check DST for the specific date
  const dateToCheck = new Date(`${dateString}T${fullTimeString}`)
  
  // Create date string in ISO format with proper timezone offset (including DST)
  const isoString = `${dateString}T${fullTimeString}${getTimezoneOffsetString(businessTimezone, dateToCheck)}`
  
  return new Date(isoString)
}

/**
 * Helper function to get timezone offset string
 * @param timezone - The timezone identifier
 * @param date - The date to check (for DST calculation)
 * @returns Offset string like "-08:00" or "-07:00"
 */
function getTimezoneOffsetString(timezone: string, date: Date = new Date()): string {
  // Use Intl.DateTimeFormat to get the actual timezone offset for the given date
  // This properly handles daylight saving time
  const formatter = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    timeZoneName: 'longOffset'
  })
  
  const parts = formatter.formatToParts(date)
  const offsetPart = parts.find(part => part.type === 'timeZoneName')
  
  if (offsetPart?.value) {
    // Convert "GMT-08:00" to "-08:00"
    const offset = offsetPart.value.replace('GMT', '').trim()
    return offset
  }
  
  // Fallback for unsupported timezones
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
 * Formats a date for display in the business timezone
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM:SS or HH:MM format
 * @param options - Intl.DateTimeFormat options
 * @param timezone - Optional timezone override
 * @returns Formatted date string
 */
export async function formatBusinessDateTime(
  dateString: string, 
  timeString: string, 
  options: Intl.DateTimeFormatOptions = {},
  timezone?: string
): Promise<string> {
  const businessTimezone = timezone || await getBusinessTimezone()
  const date = await createBusinessDateTime(dateString, timeString, businessTimezone)
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: businessTimezone,
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
 * Formats a date and time for email display with proper timezone handling
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM:SS or HH:MM format
 * @param timezone - Timezone to use (defaults to business timezone)
 * @returns Promise<string> - Formatted date and time string
 */
export async function formatEmailDateTime(
  dateString: string, 
  timeString: string, 
  timezone?: string
): Promise<string> {
  const businessTimezone = timezone || await getBusinessTimezone()
  const dateTime = new Date(`${dateString}T${timeString}`)
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: businessTimezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(dateTime)
}

/**
 * Formats a date for email display with proper timezone handling
 * @param dateString - Date in YYYY-MM-DD format
 * @param timezone - Timezone to use (defaults to business timezone)
 * @returns Promise<string> - Formatted date string
 */
export async function formatEmailDate(
  dateString: string, 
  timezone?: string
): Promise<string> {
  const businessTimezone = timezone || await getBusinessTimezone()
  const dateTime = new Date(`${dateString}T00:00:00`)
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: businessTimezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(dateTime)
}

/**
 * Formats a time for email display with proper timezone handling
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM:SS or HH:MM format
 * @param timezone - Timezone to use (defaults to business timezone)
 * @returns Promise<string> - Formatted time string with AM/PM
 */
export async function formatEmailTime(
  dateString: string, 
  timeString: string, 
  timezone?: string
): Promise<string> {
  const businessTimezone = timezone || await getBusinessTimezone()
  const dateTime = new Date(`${dateString}T${timeString}`)
  
  const options: Intl.DateTimeFormatOptions = {
    timeZone: businessTimezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(dateTime)
}

/**
 * Gets the current time in business timezone
 * @returns Promise<Date> - Date object in business timezone
 */
export async function getCurrentBusinessTime(): Promise<Date> {
  // Create a date object representing the current time in business timezone
  const businessTimezone = await getBusinessTimezone()
  const now = new Date()
  
  // Use Intl.DateTimeFormat to get the time in the business timezone
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
 * @param timezone - Optional timezone override
 * @returns Promise<Date> - End Date object in business timezone
 */
export async function calculateEndTime(
  startDate: string, 
  startTime: string, 
  durationMinutes: number,
  timezone?: string
): Promise<Date> {
  const startDateTime = await createBusinessDateTime(startDate, startTime, timezone)
  return new Date(startDateTime.getTime() + durationMinutes * 60000)
}

/**
 * Validates if a date/time is in the future
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM:SS or HH:MM format
 * @param timezone - Optional timezone override
 * @returns Promise<boolean> - true if the appointment is in the future
 */
export async function isFutureAppointment(dateString: string, timeString: string): Promise<boolean> {
  try {
    // Ensure time string has seconds if not provided
    const fullTimeString = timeString.includes(':') && timeString.split(':').length === 2 
      ? `${timeString}:00` 
      : timeString
    
    // Create appointment date in local timezone (business timezone)
    const appointmentDateTime = new Date(`${dateString}T${fullTimeString}`)
    const now = new Date()
    
    // Add a buffer to account for timezone differences and processing time
    const bufferMinutes = 10 // Increased buffer
    const bufferTime = new Date(now.getTime() - bufferMinutes * 60000) // Subtract buffer instead of adding
    
    // Debug logging
    console.log('🔍 Timezone validation:', {
      dateString,
      timeString,
      fullTimeString,
      appointmentDateTime: appointmentDateTime.toISOString(),
      now: now.toISOString(),
      bufferTime: bufferTime.toISOString(),
      isFuture: appointmentDateTime > bufferTime
    })
    
    return appointmentDateTime > bufferTime
  } catch (error) {
    console.error('Error in isFutureAppointment:', error)
    // If there's an error, default to allowing the appointment
    return true
  }
}

/**
 * Gets timezone offset for the business timezone
 * @param date - Date to check (defaults to now)
 * @returns Offset in hours from UTC
 */
export function getBusinessTimezoneOffset(date: Date = new Date()): number {
  // Pacific Standard Time (PST) is UTC-8
  // Pacific Daylight Time (PDT) is UTC-7
  // JavaScript Date.getTimezoneOffset() returns minutes, negative for ahead of UTC
  const pstOffset = 8 * 60 // 8 hours in minutes
  const pdtOffset = 7 * 60 // 7 hours in minutes
  
  // Check if date is in daylight saving time period
  const year = date.getFullYear()
  
  // DST starts on second Sunday in March, ends on first Sunday in November
  const march = new Date(year, 2, 1) // March 1st
  const november = new Date(year, 10, 1) // November 1st
  
  // Find second Sunday in March
  const secondSundayMarch = new Date(march)
  while (secondSundayMarch.getDay() !== 0) {
    secondSundayMarch.setDate(secondSundayMarch.getDate() + 1)
  }
  secondSundayMarch.setDate(secondSundayMarch.getDate() + 7)
  
  // Find first Sunday in November
  const firstSundayNovember = new Date(november)
  while (firstSundayNovember.getDay() !== 0) {
    firstSundayNovember.setDate(firstSundayNovember.getDate() + 1)
  }
  
  // Check if date is in DST period
  if (date >= secondSundayMarch && date < firstSundayNovember) {
    return -pdtOffset // PDT (UTC-7)
  } else {
    return -pstOffset // PST (UTC-8)
  }
}
