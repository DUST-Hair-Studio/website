interface BusinessHours {
  day_of_week: number
  is_open: boolean
  open_time: string
  close_time: string
  timezone: string
}

interface Booking {
  date: string
  start_time: string
  duration_minutes: number
}

interface BlockedTimeSlot {
  date: string
  start_time: string
  end_time: string
}

export interface AvailabilityOverride {
  date: string
  open_time: string
  close_time: string
}

export function generateAvailableSlots(
  startDate: string,
  endDate: string,
  businessHours: BusinessHours[],
  existingBookings: Booking[],
  blockedTimeSlots: BlockedTimeSlot[],
  serviceDuration: number,
  bufferTime: number = 0,
  availabilityOverrides?: AvailabilityOverride[]
): string[] {
  const availableSlots: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  const overridesByDate = new Map(
    (availabilityOverrides || []).map(o => [o.date, o])
  )

  // Generate slots for each day in the range
  const current = new Date(start)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    const override = overridesByDate.get(dateStr)

    let openTime: { hours: number; minutes: number } | null
    let closeTime: { hours: number; minutes: number } | null

    if (override) {
      // One-time open date: use override hours
      openTime = parseTime(override.open_time)
      closeTime = parseTime(override.close_time)
    } else {
      const localDate = new Date(dateStr + 'T00:00:00')
      const dayOfWeek = localDate.getDay()
      const dayHours = businessHours.find(hours => hours.day_of_week === dayOfWeek)
      if (!dayHours || !dayHours.is_open) {
        current.setDate(current.getDate() + 1)
        continue
      }
      openTime = parseTime(dayHours.open_time)
      closeTime = parseTime(dayHours.close_time)
    }

    if (!openTime || !closeTime) {
      current.setDate(current.getDate() + 1)
      continue
    }

    const daySlots = generateTimeSlotsForDay(
      dateStr,
      openTime,
      closeTime,
      serviceDuration,
      bufferTime,
      existingBookings.filter(booking => booking.date === dateStr),
      blockedTimeSlots.filter(blocked => blocked.date === dateStr)
    )

    availableSlots.push(...daySlots)
    current.setDate(current.getDate() + 1)
  }

  return availableSlots
}

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null
  
  const [hours, minutes] = timeStr.split(':').map(Number)
  return { hours, minutes }
}

function generateTimeSlotsForDay(
  date: string,
  openTime: { hours: number; minutes: number },
  closeTime: { hours: number; minutes: number },
  serviceDuration: number,
  bufferTime: number,
  existingBookings: Booking[],
  blockedTimeSlots: BlockedTimeSlot[]
): string[] {
  const slots: string[] = []
  
  // Convert to minutes for easier calculation
  const openMinutes = openTime.hours * 60 + openTime.minutes
  const closeMinutes = closeTime.hours * 60 + closeTime.minutes
  
  // Generate slots every 30 minutes
  for (let minutes = openMinutes; minutes < closeMinutes; minutes += 30) {
    const slotEndMinutes = minutes + serviceDuration + bufferTime
    
    // Check if slot extends beyond closing time
    if (slotEndMinutes > closeMinutes) {
      break
    }
    
    // Check for conflicts with existing bookings
    const hasBookingConflict = existingBookings.some(booking => {
      const bookingStart = parseTimeToMinutes(booking.start_time)
      const bookingEnd = bookingStart + booking.duration_minutes
      
      // Check if the new slot overlaps with existing booking
      // New slot: [minutes, slotEndMinutes]
      // Existing booking: [bookingStart, bookingEnd]
      // They overlap if: minutes < bookingEnd && slotEndMinutes > bookingStart
      const overlaps = minutes < bookingEnd && slotEndMinutes > bookingStart
      
      
      return overlaps
    })
    
    // Check for conflicts with blocked time
    const hasBlockedConflict = blockedTimeSlots.some(blocked => {
      const blockedStart = parseTimeToMinutes(blocked.start_time)
      const blockedEnd = parseTimeToMinutes(blocked.end_time)
      
      const overlaps = minutes < blockedEnd && slotEndMinutes > blockedStart
      
      
      return overlaps
    })
    
    if (!hasBookingConflict && !hasBlockedConflict) {
      const timeStr = minutesToTimeString(minutes)
      slots.push(timeStr)
    }
  }
  
  return slots
}

function parseTimeToMinutes(timeStr: string): number {
  // Handle "HH:MM:SS", "HH:MM", and "H:MM AM/PM" formats
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i)
  if (!timeMatch) return 0
  
  let hours = parseInt(timeMatch[1])
  const minutes = parseInt(timeMatch[2])
  const period = timeMatch[3]?.toUpperCase()
  
  // Convert to 24-hour format if period is specified
  if (period === 'PM' && hours !== 12) {
    hours += 12
  } else if (period === 'AM' && hours === 12) {
    hours = 0
  }
  
  return hours * 60 + minutes
}

function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`
}
