/**
 * Timezone utilities for consistent date handling across the application
 * This prevents the recurring timezone issues by centralizing all date operations
 */

export const BUSINESS_TIMEZONE = 'America/Los_Angeles' // Pacific Time

/**
 * Creates a Date object in the business timezone from date and time strings
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM:SS or HH:MM format
 * @returns Date object representing the local time in business timezone
 */
export function createBusinessDateTime(dateString: string, timeString: string): Date {
  // Ensure time string has seconds if not provided
  const fullTimeString = timeString.includes(':') && timeString.split(':').length === 2 
    ? `${timeString}:00` 
    : timeString
  
  // Create date string in ISO format with Pacific timezone offset
  const isoString = `${dateString}T${fullTimeString}-08:00`
  
  return new Date(isoString)
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
 * @returns Formatted date string
 */
export function formatBusinessDateTime(
  dateString: string, 
  timeString: string, 
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = createBusinessDateTime(dateString, timeString)
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: BUSINESS_TIMEZONE,
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
 * Gets the current time in business timezone
 * @returns Date object in business timezone
 */
export function getCurrentBusinessTime(): Date {
  // Create a date object representing the current time in Pacific timezone
  // by using the timezone offset
  const now = new Date()
  const pacificOffset = getBusinessTimezoneOffset(now)
  return new Date(now.getTime() - (pacificOffset * 60 * 1000))
}

/**
 * Calculates end time for an appointment
 * @param startDate - Start date
 * @param startTime - Start time
 * @param durationMinutes - Duration in minutes
 * @returns End Date object in business timezone
 */
export function calculateEndTime(
  startDate: string, 
  startTime: string, 
  durationMinutes: number
): Date {
  const startDateTime = createBusinessDateTime(startDate, startTime)
  return new Date(startDateTime.getTime() + durationMinutes * 60000)
}

/**
 * Validates if a date/time is in the future
 * @param dateString - Date in YYYY-MM-DD format
 * @param timeString - Time in HH:MM:SS or HH:MM format
 * @returns true if the appointment is in the future
 */
export function isFutureAppointment(dateString: string, timeString: string): boolean {
  const appointmentTime = createBusinessDateTime(dateString, timeString)
  const now = getCurrentBusinessTime()
  return appointmentTime > now
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
