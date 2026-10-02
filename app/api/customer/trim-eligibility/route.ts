import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { getServiceTrimRole, getTrimBlockedRanges } from '@/lib/trim-limit'

// Dates where the signed-in customer can't book another trim (one trim between haircuts).
// With ?bookingId= (reschedule), that booking is ignored and `isTrim` says whether the rule applies to it.
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: customerByAuthId } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()
    const { data: customerByEmail } = customerByAuthId
      ? { data: null }
      : await supabase.from('customers').select('id').eq('email', user.email).single()
    const customer = customerByAuthId || customerByEmail

    // No customer record yet means no bookings, so nothing is blocked
    if (!customer) {
      return NextResponse.json({ ranges: [], isTrim: false })
    }

    const adminSupabase = createAdminSupabaseClient()
    const bookingId = new URL(request.url).searchParams.get('bookingId') || undefined

    let isTrim = false
    if (bookingId) {
      const { data: booking } = await adminSupabase
        .from('bookings')
        .select('service_id')
        .eq('id', bookingId)
        .eq('customer_id', customer.id)
        .single()
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }
      isTrim = (await getServiceTrimRole(adminSupabase, booking.service_id)) === 'trim'
    }

    const ranges = await getTrimBlockedRanges(adminSupabase, customer.id, bookingId)
    return NextResponse.json({ ranges, isTrim })
  } catch (error) {
    console.error('Trim eligibility API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
