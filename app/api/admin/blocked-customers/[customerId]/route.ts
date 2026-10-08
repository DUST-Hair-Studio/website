import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

// DELETE unblock a customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const auth = await requireAdmin()
    if ('response' in auth) return auth.response

    const { customerId } = await params
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase
      .from('blocked_customers')
      .delete()
      .eq('customer_id', customerId)

    if (error) {
      console.error('Error unblocking customer:', error)
      return NextResponse.json({ error: 'Failed to unblock customer' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin unblock customer API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
