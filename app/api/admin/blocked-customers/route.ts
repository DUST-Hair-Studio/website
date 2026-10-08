import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

// GET customers blocked from booking new appointments
export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('response' in auth) return auth.response

    const supabase = createAdminSupabaseClient()
    const { data: blocked, error } = await supabase
      .from('blocked_customers')
      .select(`
        customer_id,
        reason,
        blocked_by,
        blocked_at,
        customers (
          name,
          email,
          phone
        )
      `)
      .order('blocked_at', { ascending: false })

    if (error) {
      console.error('Error fetching blocked customers:', error)
      return NextResponse.json({ error: 'Failed to fetch blocked customers' }, { status: 500 })
    }

    return NextResponse.json({ blocked })
  } catch (error) {
    console.error('Admin blocked customers API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST block a customer: { customerId, reason? }
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ('response' in auth) return auth.response

    const { customerId, reason } = await request.json()
    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .single()
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('blocked_customers')
      .upsert({
        customer_id: customerId,
        reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
        blocked_by: auth.email,
        blocked_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Error blocking customer:', error)
      return NextResponse.json({ error: 'Failed to block customer' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin block customer API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
