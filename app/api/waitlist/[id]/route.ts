import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin client for database operations (bypasses RLS)
    const adminSupabase = createAdminSupabaseClient()

    // Get customer_id from auth user
    const { data: customer, error: customerError } = await adminSupabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    const { id: waitlistId } = await params

    // Get the waitlist request
    const { data: waitlistRequest, error: fetchError } = await adminSupabase
      .from('waitlist_requests')
      .select('*')
      .eq('id', waitlistId)
      .eq('customer_id', customer.id)
      .single()

    if (fetchError || !waitlistRequest) {
      return NextResponse.json(
        { error: 'Waitlist request not found' },
        { status: 404 }
      )
    }

    // Update status to cancelled instead of deleting (for record keeping)
    const { error: updateError } = await adminSupabase
      .from('waitlist_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', waitlistId)

    if (updateError) {
      console.error('Error cancelling waitlist request:', updateError)
      return NextResponse.json(
        { error: 'Failed to cancel waitlist request' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Waitlist request cancelled successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/waitlist/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

