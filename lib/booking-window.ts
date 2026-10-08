import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_BUSINESS_TIMEZONE, getBusinessTodayString } from '@/lib/timezone-utils'

// How far ahead customers can book, set in Admin > Settings > Schedule (settings.booking_window_months).
// Unset/0 = no limit. Applies to customer booking and reschedule; admin booking routes don't check it.

export const BOOKING_WINDOW_SETTING_KEY = 'booking_window_months'

export function parseBookingWindowMonths(value: unknown): number | null {
  const months = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
  return Number.isFinite(months) && months > 0 ? Math.floor(months) : null
}

/** Adds calendar months to a YYYY-MM-DD date, clamping to the end of shorter months (Nov 30 + 3 → Feb 28). */
export function addMonthsYMD(ymd: string, months: number): string {
  const [year, month, day] = ymd.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

/** Last date (YYYY-MM-DD, business timezone) customers can book, or null if there's no limit. */
export function getBookingWindowEnd(months: number | null, timezone: string): string | null {
  return months ? addMonthsYMD(getBusinessTodayString(timezone), months) : null
}

/** Loads the setting and returns the last bookable date, or null if there's no limit. */
export async function loadBookingWindowEnd(supabase: SupabaseClient): Promise<{ months: number | null; endDate: string | null }> {
  const { data: settings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [BOOKING_WINDOW_SETTING_KEY, 'business_hours_timezone'])
  const map = Object.fromEntries((settings || []).map((s) => [s.key, s.value]))
  const months = parseBookingWindowMonths(map[BOOKING_WINDOW_SETTING_KEY])
  const timezone = (map.business_hours_timezone as string) || DEFAULT_BUSINESS_TIMEZONE
  return { months, endDate: getBookingWindowEnd(months, timezone) }
}

export function bookingWindowMessage(months: number): string {
  return `Appointments can only be booked up to ${months} month${months === 1 ? '' : 's'} in advance. Please choose an earlier date.`
}
