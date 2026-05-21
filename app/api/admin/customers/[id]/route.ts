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
      notes,
    } = body

    // Read prior state so we can detect a customer-type change and cascade pricing.
    let priorIsExisting: boolean | null = null
    if (is_existing_customer !== undefined) {
      const { data: prior } = await supabase
        .from('customers')
        .select('is_existing_customer')
        .eq('id', id)
        .single()
      priorIsExisting = prior?.is_existing_customer ?? null
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
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

    // Cascade: when customer type changes, re-price all of this customer's open
    // bookings (pre-checkout: status pending/confirmed AND payment_status pending).
    let bookingsUpdated = 0
    const nextIsExisting = customer.is_existing_customer === true
    if (
      is_existing_customer !== undefined &&
      priorIsExisting !== null &&
      priorIsExisting !== nextIsExisting
    ) {
      const { data: openBookings, error: openErr } = await supabase
        .from('bookings')
        .select(`
          id,
          services (
            new_customer_price,
            existing_customer_price
          )
        `)
        .eq('customer_id', id)
        .in('status', ['pending', 'confirmed'])
        .eq('payment_status', 'pending')

      if (openErr) {
        console.error('Error fetching open bookings for cascade:', openErr)
      } else if (openBookings && openBookings.length > 0) {
        const nextCustomerType = nextIsExisting ? 'existing' : 'new'
        for (const b of openBookings as Array<{ id: string; services: { new_customer_price: number; existing_customer_price: number } | { new_customer_price: number; existing_customer_price: number }[] | null }>) {
          // services may come back as an array depending on the query shape
          const svc = Array.isArray(b.services) ? b.services[0] : b.services
          if (!svc) continue
          const newPrice = nextIsExisting ? svc.existing_customer_price : svc.new_customer_price
          const { error: bErr } = await supabase
            .from('bookings')
            .update({
              customer_type_at_booking: nextCustomerType,
              price_charged: newPrice,
              updated_at: new Date().toISOString(),
            })
            .eq('id', b.id)
          if (bErr) {
            console.error('Error cascading price to booking', b.id, bErr)
          } else {
            bookingsUpdated += 1
          }
        }
      }
    }

    return NextResponse.json({ customer, bookingsUpdated })

  } catch (error) {
    console.error('Admin customer update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
