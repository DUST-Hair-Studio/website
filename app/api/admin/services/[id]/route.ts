import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

// GET single service by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id } = await params

    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching service:', error)
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    return NextResponse.json({ service })
  } catch (error) {
    console.error('Admin get service API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH update service
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
      description,
      duration_minutes,
      new_customer_price,
      existing_customer_price,
      is_active,
      is_existing_customer,
      is_new_customer,
      category,
      sort_order
    } = body

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (duration_minutes !== undefined) updateData.duration_minutes = parseInt(duration_minutes)
    if (new_customer_price !== undefined) updateData.new_customer_price = parseInt(new_customer_price)
    if (existing_customer_price !== undefined) updateData.existing_customer_price = parseInt(existing_customer_price)
    if (is_active !== undefined) updateData.is_active = Boolean(is_active)
    if (is_existing_customer !== undefined) updateData.is_existing_customer = Boolean(is_existing_customer)
    if (is_new_customer !== undefined) updateData.is_new_customer = Boolean(is_new_customer)
    if (category !== undefined) updateData.category = category
    if (sort_order !== undefined) updateData.sort_order = parseInt(sort_order)

    console.log('🔍 PATCH API: Attempting to update service with ID:', id)
    console.log('🔍 PATCH API: Update data:', updateData)

    // First check if the service exists
    const { data: existingService, error: checkError } = await supabase
      .from('services')
      .select('id, name')
      .eq('id', id)
      .single()

    console.log('🔍 PATCH API: Existing service check:', { existingService, checkError })

    if (checkError || !existingService) {
      console.log('🔍 PATCH API: Service not found, returning 404')
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Let's also check what the current service looks like
    const { data: currentService, error: currentError } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single()

    console.log('🔍 PATCH API: Current service data:', {
      currentService,
      currentError
    })

        console.log('🔍 PATCH API: Proceeding with update...')
        const { data: service, error } = await supabase
          .from('services')
          .update(updateData)
          .eq('id', id)
          .select('*')

        console.log('🔍 PATCH API: Update result:', { service, error })

        if (error) {
          console.error('Error updating service:', error)
          return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
        }

        if (!service || service.length === 0) {
          console.log('🔍 PATCH API: No service returned after update')
          return NextResponse.json({ error: 'Service not found after update' }, { status: 404 })
        }

        return NextResponse.json({ service: service[0] })
  } catch (error) {
    console.error('Admin update service API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE service
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminSupabaseClient()
    const { id } = await params

    console.log('🔍 DELETE API: Attempting to delete service with ID:', id)

    // Check if service has any bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id')
      .eq('service_id', id)
      .limit(1)

    console.log('🔍 DELETE API: Bookings check result:', { bookings, bookingsError })

    if (bookingsError) {
      console.error('Error checking service bookings:', bookingsError)
      return NextResponse.json({ error: 'Failed to check service dependencies' }, { status: 500 })
    }

    if (bookings && bookings.length > 0) {
      console.log('🔍 DELETE API: Service has bookings, cannot delete')
      return NextResponse.json({ 
        error: 'Cannot delete service with existing bookings. Deactivate it instead.' 
      }, { status: 400 })
    }

    console.log('🔍 DELETE API: Proceeding with deletion...')
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)

    console.log('🔍 DELETE API: Deletion result:', { error })

    if (error) {
      console.error('Error deleting service:', error)
      return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
    }

    console.log('🔍 DELETE API: Service deleted successfully')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin delete service API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}