import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// GET all services (including inactive ones for admin)
export async function GET() {
  try {
    const supabase = createAdminSupabaseClient()
    
    // Fetch all services, ordered by sort_order
    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching services:', error)
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
    }

    return NextResponse.json({ services })
  } catch (error) {
    console.error('Admin services API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST create new service
export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminSupabaseClient()
    const body = await request.json()
    
    const {
      name,
      description,
      duration_minutes,
      new_customer_price,
      existing_customer_price,
      is_active = true,
      is_existing_customer = true,
      is_new_customer = true,
      category,
      sort_order = 0
    } = body

    // Validate required fields
    if (!name || !duration_minutes || new_customer_price === undefined || existing_customer_price === undefined) {
      return NextResponse.json({ 
        error: 'Missing required fields: name, duration_minutes, new_customer_price, existing_customer_price' 
      }, { status: 400 })
    }

    // Create service
    const { data: service, error } = await supabase
      .from('services')
      .insert({
        name,
        description: description || null,
        duration_minutes: parseInt(duration_minutes),
        new_customer_price: parseInt(new_customer_price), // Store in cents
        existing_customer_price: parseInt(existing_customer_price), // Store in cents
        is_active: Boolean(is_active),
        is_existing_customer: Boolean(is_existing_customer),
        is_new_customer: Boolean(is_new_customer),
        category: category || null,
        sort_order: parseInt(sort_order) || 0
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error creating service:', error)
      return NextResponse.json({ error: 'Failed to create service' }, { status: 500 })
    }

    return NextResponse.json({ service }, { status: 201 })
  } catch (error) {
    console.error('Admin create service API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
