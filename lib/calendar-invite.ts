import ical, { ICalCalendarMethod, ICalEventStatus } from 'ical-generator'
import { getVtimezoneComponent } from '@touch4it/ical-timezones'
import { createBusinessDateTimeSync, normalizeBookingTimeForIso } from '@/lib/timezone-utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CalendarEventInput = {
  bookingId: string
  date: string              // YYYY-MM-DD
  time: string              // HH:MM or "12:00 PM" etc.
  durationMinutes: number
  clientName: string
  serviceName: string
  businessTimezone: string  // IANA, e.g. "America/Los_Angeles"
  location?: string
  /** For reschedule: pass 1 so calendar clients treat it as an update to the original event */
  sequence?: number
}

// ─── UID ──────────────────────────────────────────────────────────────────────

function buildUID(bookingId: string): string {
  return `booking-${bookingId}@dusthairstudio.com`
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createCalendar(businessTimezone: string) {
  const cal = ical({ prodId: 'DUST Hair Studio' })
  cal.timezone({
    name: businessTimezone,
    generator: getVtimezoneComponent,
  })
  return cal
}

// ─── ICS builders ─────────────────────────────────────────────────────────────

/**
 * Builds an ICS string for a confirmed or rescheduled appointment.
 * Uses TZID + VTIMEZONE so Gmail and other clients display the correct local time.
 *
 * Returns a base64-encoded string ready for Resend's attachments array.
 */
export function buildConfirmationICS(input: CalendarEventInput): string {
  const {
    bookingId,
    durationMinutes,
    clientName,
    serviceName,
    businessTimezone,
    location,
    sequence = 0,
  } = input

  // Use explicit local time strings so ical-generator outputs DTSTART;TZID=...:YYYYMMDDThhmmss
  // with the exact local time (avoids Date→timezone conversion issues on UTC servers)
  const normalized = normalizeBookingTimeForIso(input.time)
  const [startH, startM] = normalized.split(':').map(Number)
  const totalStartMins = startH * 60 + startM
  const totalEndMins = totalStartMins + durationMinutes
  const endH = Math.floor(totalEndMins / 60) % 24
  const endM = totalEndMins % 60
  const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`

  const cal = createCalendar(businessTimezone)
  cal.method(ICalCalendarMethod.REQUEST)

  cal.createEvent({
    id: buildUID(bookingId),
    start: `${input.date}T${normalized}`,
    end: `${input.date}T${endTimeStr}`,
    timezone: businessTimezone,
    sequence,
    status: ICalEventStatus.CONFIRMED,
    summary: `${serviceName} at DUST Hair Studio`,
    description: `Appointment for ${clientName}`,
    location: location ?? 'DUST Hair Studio',
    organizer: {
      name: 'DUST Hair Studio',
      email: 'appointments@dusthairstudio.com',
    },
  })

  const value = cal.toString()
  if (!value) throw new Error('Failed to generate confirmation ICS')
  return Buffer.from(value).toString('base64')
}

/**
 * Builds an ICS string for a cancelled appointment.
 * Uses TZID + VTIMEZONE for consistent display. UID must match the original.
 *
 * Returns a base64-encoded string ready for Resend's attachments array.
 */
export function buildCancellationICS(input: CalendarEventInput): string {
  const {
    bookingId,
    durationMinutes,
    serviceName,
    businessTimezone,
    location,
  } = input

  const normalized = normalizeBookingTimeForIso(input.time)
  const [startH, startM] = normalized.split(':').map(Number)
  const totalStartMins = startH * 60 + startM
  const totalEndMins = totalStartMins + durationMinutes
  const endH = Math.floor(totalEndMins / 60) % 24
  const endM = totalEndMins % 60
  const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`

  const cal = createCalendar(businessTimezone)
  cal.method(ICalCalendarMethod.CANCEL)

  cal.createEvent({
    id: buildUID(bookingId),
    start: `${input.date}T${normalized}`,
    end: `${input.date}T${endTimeStr}`,
    timezone: businessTimezone,
    sequence: 1,
    status: ICalEventStatus.CANCELLED,
    summary: `${serviceName} at DUST Hair Studio`,
    location: location ?? 'DUST Hair Studio',
    organizer: {
      name: 'DUST Hair Studio',
      email: 'appointments@dusthairstudio.com',
    },
  })

  const value = cal.toString()
  if (!value) throw new Error('Failed to generate cancellation ICS')
  return Buffer.from(value).toString('base64')
}

// ─── Google Calendar fallback URL ─────────────────────────────────────────────

/**
 * Builds a Google Calendar add-event URL.
 * Uses UTC in the URL (Google converts to user's timezone when adding).
 * For Gmail preview, the ICS attachment with TZID is the primary source of truth.
 */
export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const { date, time, durationMinutes, serviceName, businessTimezone, location } = input

  const start = createBusinessDateTimeSync(date, time, businessTimezone)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

  // GCal expects UTC timestamps in YYYYMMDDTHHmmssZ format
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${serviceName} at DUST Hair Studio`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: 'Your appointment at DUST Hair Studio.',
    location: location ?? 'DUST Hair Studio',
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
