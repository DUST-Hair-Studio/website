import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

const PAYMENT_STATUSES = ['paid', 'pending', 'refunded', 'void'] as const
const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'] as const
type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
type BookingStatus = (typeof BOOKING_STATUSES)[number]

interface BulkUpdateBody {
  ids: string[]
  payment_status?: PaymentStatus
  status?: BookingStatus
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = (await request.json()) as BulkUpdateBody
    const { ids, payment_status, status } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }
    if (!payment_status && !status) {
      return NextResponse.json(
        { error: 'Provide payment_status or status to update' },
        { status: 400 }
      )
    }
    if (payment_status && !PAYMENT_STATUSES.includes(payment_status)) {
      return NextResponse.json({ error: 'Invalid payment_status' }, { status: 400 })
    }
    if (status && !BOOKING_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const skipped: Array<{ id: string; reason: string }> = []
    let targetIds = ids
    let pendingIdsForCancel: Set<string> = new Set()

    // If cancelling, exclude already-paid bookings and track which ones need
    // payment_status auto-flipped to 'cancelled'.
    if (status === 'cancelled') {
      const { data: existing, error } = await supabase
        .from('bookings')
        .select('id, payment_status')
        .in('id', ids)
      if (error) {
        console.error('Bulk update prefetch error', error)
        return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
      }
      const allowedIds: string[] = []
      const pendingIds: string[] = []
      for (const row of existing || []) {
        if (row.payment_status === 'paid') {
          skipped.push({ id: row.id, reason: 'paid bookings cannot be cancelled — refund first' })
        } else {
          allowedIds.push(row.id)
          if (row.payment_status === 'pending') pendingIds.push(row.id)
        }
      }
      targetIds = allowedIds
      pendingIdsForCancel = new Set(pendingIds)
    }

    // If voiding, only allow currently-pending bookings on non-cancelled appointments.
    if (payment_status === 'void') {
      const { data: existing, error } = await supabase
        .from('bookings')
        .select('id, payment_status, status')
        .in('id', ids)
      if (error) {
        console.error('Bulk void prefetch error', error)
        return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
      }
      const allowedIds: string[] = []
      for (const row of existing || []) {
        if (row.payment_status !== 'pending') {
          skipped.push({ id: row.id, reason: `only pending invoices can be voided (current: ${row.payment_status})` })
        } else if (row.status === 'cancelled') {
          skipped.push({ id: row.id, reason: 'cancelled bookings already have their charge written off' })
        } else {
          allowedIds.push(row.id)
        }
      }
      targetIds = allowedIds
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ updated: 0, skipped })
    }

    const updateData: {
      updated_at: string
      status?: BookingStatus
      payment_status?: PaymentStatus
      paid_at?: string | null
      voided_at?: string | null
      void_reason?: string | null
    } = { updated_at: new Date().toISOString() }

    if (status) updateData.status = status
    if (payment_status) {
      updateData.payment_status = payment_status
      if (payment_status === 'paid') {
        updateData.paid_at = new Date().toISOString()
      } else {
        updateData.paid_at = null
      }
      if (payment_status === 'void') {
        updateData.voided_at = new Date().toISOString()
        updateData.void_reason = null
      } else {
        updateData.voided_at = null
        updateData.void_reason = null
      }
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updateData)
      .in('id', targetIds)
      .select('id')

    // Second pass: flip pending payments to 'cancelled' for bulk-cancelled bookings.
    if (status === 'cancelled' && pendingIdsForCancel.size > 0 && !payment_status) {
      const { error: flipError } = await supabase
        .from('bookings')
        .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
        .in('id', Array.from(pendingIdsForCancel))
      if (flipError) {
        console.error('Bulk cancel: payment auto-flip error', flipError)
      }
    }

    if (error) {
      console.error('Bulk update error', error)
      return NextResponse.json({ error: 'Failed to update bookings' }, { status: 500 })
    }

    return NextResponse.json({ updated: (data || []).length, skipped })
  } catch (error) {
    console.error('Bulk update API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
