import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { EmailService } from '@/lib/email-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Waitlist API - Starting POST request')
    console.log('🚀 Waitlist API - Creating Supabase client')
    const supabase = await createServerSupabaseClient()
    console.log('🚀 Waitlist API - Supabase client created successfully')
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('🔍 Waitlist API - Auth check:', { user: user?.id, error: authError?.message })
    
    if (authError || !user) {
      console.log('❌ Waitlist API - Unauthorized')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin client for database operations (bypasses RLS)
    const adminSupabase = createAdminSupabaseClient()

    // Check if waitlist is enabled
    const { data: settings, error: settingsError } = await adminSupabase
      .from('settings')
      .select('value')
      .eq('key', 'waitlist_enabled')
      .single()

    const waitlistEnabled = settings?.value !== false // Default to true if not set
    console.log('🔍 Waitlist API - Waitlist enabled:', waitlistEnabled)

    if (!waitlistEnabled) {
      console.log('❌ Waitlist API - Waitlist is disabled')
      return NextResponse.json(
        { error: 'Waitlist is currently disabled' },
        { status: 403 }
      )
    }

    // Get customer_id from auth user
    console.log('🔍 Waitlist API - Looking up customer for user:', user.id)
    const { data: customer, error: customerError } = await adminSupabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    console.log('🔍 Waitlist API - Customer lookup result:', { customer, error: customerError?.message })

    if (customerError || !customer) {
      console.log('❌ Waitlist API - Customer not found:', customerError?.message)
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { service_id, start_date, end_date } = body
    console.log('🔍 Waitlist API - Request body:', { service_id, start_date, end_date })

    // Validate required fields
    if (!service_id || !start_date || !end_date) {
      console.log('❌ Waitlist API - Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: service_id, start_date, end_date' },
        { status: 400 }
      )
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Validate date range
    const startDateObj = new Date(start_date)
    const endDateObj = new Date(end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (startDateObj < today) {
      return NextResponse.json(
        { error: 'Start date cannot be in the past' },
        { status: 400 }
      )
    }

    if (endDateObj < startDateObj) {
      return NextResponse.json(
        { error: 'End date must be after or equal to start date' },
        { status: 400 }
      )
    }

    // Check if service exists
    const { data: service, error: serviceError } = await adminSupabase
      .from('services')
      .select('id, name, is_active')
      .eq('id', service_id)
      .single()

    if (serviceError || !service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      )
    }

    if (!service.is_active) {
      return NextResponse.json(
        { error: 'Service is not currently available' },
        { status: 400 }
      )
    }

    // Check for existing pending waitlist entry for same criteria
    const { data: existingWaitlist } = await adminSupabase
      .from('waitlist_requests')
      .select('id')
      .eq('customer_id', customer.id)
      .eq('service_id', service_id)
      .eq('start_date', start_date)
      .eq('end_date', end_date)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingWaitlist) {
      return NextResponse.json(
        { error: 'You already have a pending waitlist request for these dates and service' },
        { status: 409 }
      )
    }

    // Create waitlist request
    const { data: waitlistRequest, error: insertError } = await adminSupabase
      .from('waitlist_requests')
      .insert({
        customer_id: customer.id,
        service_id,
        start_date,
        end_date,
        status: 'pending'
      })
      .select(`
        *,
        services (
          name,
          description,
          duration_minutes
        )
      `)
      .single()

    if (insertError) {
      console.error('Error creating waitlist request:', insertError)
      return NextResponse.json(
        { error: 'Failed to create waitlist request' },
        { status: 500 }
      )
    }

    console.log('✅ Waitlist API - Request created successfully:', waitlistRequest.id)

    // Send confirmation email
    try {
      const emailService = new EmailService()
      
      // Get customer details for email
      const { data: customerData } = await adminSupabase
        .from('customers')
        .select('name, email')
        .eq('id', customer.id)
        .single()

      if (customerData) {
        console.log('📧 Waitlist API - Sending confirmation email to:', customerData.email)
        await emailService.sendWaitlistConfirmationEmail({
          customer: {
            name: customerData.name,
            email: customerData.email
          },
          service: {
            name: service.name
          },
          start_date,
          end_date
        })
        console.log('✅ Waitlist API - Confirmation email sent')
      }
    } catch (emailError) {
      // Don't fail the request if email fails
      console.error('⚠️ Waitlist API - Error sending confirmation email:', emailError)
      // Continue anyway - waitlist request was created successfully
    }

    return NextResponse.json({
      message: 'Successfully added to waitlist',
      waitlist: waitlistRequest
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Waitlist API - Error in POST /api/waitlist:', error)
    console.error('❌ Waitlist API - Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

