import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params
    const body = await request.json()
    const { is_existing_customer } = body

    const { data: customer, error } = await supabase
      .from('customers')
      .update({
        is_existing_customer,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating customer:', error)
      return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
    }

    return NextResponse.json({ customer })

  } catch (error) {
    console.error('Admin customer update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
