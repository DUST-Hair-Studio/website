import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// Customers an admin has blocked from booking new appointments (blocked_customers table).
// Blocking is silent: the customer is never told. Their availability is always empty (the
// books look full), booking attempts fail like a taken slot, and waitlist signups are accepted
// but never notified. Admin booking routes intentionally don't check it.
// Pass a service-role client: the table has RLS with no policies.

// Same wording a customer would see if someone else grabbed the slot first
export const SLOT_UNAVAILABLE_MESSAGE = 'Sorry, that time is no longer available. Please choose another time.'

export async function isCustomerBookingBlocked(supabase: SupabaseClient, customerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocked_customers')
    .select('customer_id')
    .eq('customer_id', customerId)
    .maybeSingle()

  if (error) {
    // Fail open: a lookup error shouldn't stop everyone booking
    console.error('Booking block: lookup failed:', error)
    return false
  }
  return !!data
}

/** Whether the signed-in customer making this request is blocked. False for guests and admins. */
export async function isRequestCustomerBlocked(): Promise<boolean> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const adminSupabase = createAdminSupabaseClient()
  const { data: customerByAuthId } = await adminSupabase
    .from('customers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  const { data: customerByEmail } = customerByAuthId || !user.email
    ? { data: null }
    : await adminSupabase.from('customers').select('id').eq('email', user.email).maybeSingle()
  const customer = customerByAuthId || customerByEmail
  if (!customer) return false

  return isCustomerBookingBlocked(adminSupabase, customer.id)
}

/** IDs of all blocked customers, for skipping them in bulk jobs (e.g. waitlist notifications). */
export async function getBlockedCustomerIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from('blocked_customers').select('customer_id')
  if (error) {
    console.error('Booking block: failed to load blocked customers:', error)
    return new Set()
  }
  return new Set((data || []).map((row) => row.customer_id as string))
}
