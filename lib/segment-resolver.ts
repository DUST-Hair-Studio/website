import type { SupabaseClient } from '@supabase/supabase-js'

export interface SegmentRules {
  customerType?: 'all' | 'loyalty' | 'new'
  lastBookedWithinDays?: number | null
  hasNeverBooked?: boolean | null
  hasEmail?: boolean | null
}

interface CustomerRow {
  email: string | null
  is_existing_customer: boolean
  bookings?: Array<{ booking_date: string }> | null
}

/** Resolve rule-based segment to list of normalized emails. */
export async function resolveSegmentEmails(
  supabase: SupabaseClient,
  rules: SegmentRules | null | undefined
): Promise<string[]> {
  const customerType = rules?.customerType || 'all'
  const lastBookedWithinDays = rules?.lastBookedWithinDays
  const hasNeverBooked = rules?.hasNeverBooked
  const hasEmail = rules?.hasEmail !== false

  const { data: customers } = await supabase
    .from('customers')
    .select('email, is_existing_customer, bookings(booking_date)')

  const list = (customers || []) as CustomerRow[]
  const getBookingStats = (c: CustomerRow) => {
    const bks = c.bookings || []
    const total = bks.length
    const lastDate = bks.length > 0
      ? bks.map((b) => b.booking_date).sort().reverse()[0]
      : null
    return { total, lastDate }
  }
  const valid = (e: string) => e && e.includes('@')
  const norm = (e: string) => e.trim().toLowerCase()

  const filtered = list.filter((c) => {
    if (hasEmail && (!c.email || !valid(c.email))) return false
    if (customerType === 'loyalty' && !c.is_existing_customer) return false
    if (customerType === 'new' && c.is_existing_customer) return false
    const { total, lastDate } = getBookingStats(c)
    if (hasNeverBooked === true && total > 0) return false
    if (typeof lastBookedWithinDays === 'number' && lastBookedWithinDays > 0) {
      if (!lastDate) return false
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - lastBookedWithinDays)
      if (new Date(lastDate) < cutoff) return false
    }
    return true
  })

  return [...new Set(filtered.map((c) => norm(c.email!)))]
}

/** Resolve segment (rule-based or manual) to contact count. */
export async function resolveSegmentCount(
  supabase: SupabaseClient,
  seg: {
    type: string
    rules?: SegmentRules | null
    emails?: string[] | null
  }
): Promise<number> {
  if (seg.type === 'manual') {
    return (seg.emails || []).length
  }
  const emails = await resolveSegmentEmails(supabase, seg.rules)
  return emails.length
}
