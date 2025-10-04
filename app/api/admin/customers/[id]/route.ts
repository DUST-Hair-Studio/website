import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET single customer with booking history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminSupabaseClient()
    const { id } = await params

    const { data: customer, error } = await supabase
      .from('customers')
      .select(`
        *,
        bookings (
          id,
          booking_date,
          booking_time,
          status,
          price_charged,
          customer_type_at_booking,
          services (
            name,
            duration_minutes
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching customer:', error)
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json({ customer })
  } catch (error) {
    console.error('Admin get customer API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminSupabaseClient()
    const { id } = await params
    const body = await request.json()
    const { 
      name, 
      email, 
      phone, 
      is_existing_customer, 
      notes 
    } = body

    // Build update object with only provided fields
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (is_existing_customer !== undefined) updateData.is_existing_customer = Boolean(is_existing_customer)
    if (notes !== undefined) updateData.notes = notes

    const { data: customer, error } = await supabase
      .from('customers')
      .update(updateData)
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
