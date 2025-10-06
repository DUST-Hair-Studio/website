import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('🔍 Customer API - User:', user?.email, user?.id)
    
    if (authError || !user) {
      console.log('❌ Customer API - Not authenticated:', authError)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Try multiple ways to find the customer record
    let customer = null
    let error = null
    
    // First try: auth_user_id
    const { data: customerByAuthId, error: errorByAuthId } = await supabase
      .from('customers')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()
    
    if (customerByAuthId && !errorByAuthId) {
      customer = customerByAuthId
      console.log('🔍 Found customer by auth_user_id')
    } else {
      console.log('🔍 No customer found by auth_user_id, trying email...')
      
      // Second try: email (fallback)
      const { data: customerByEmail, error: errorByEmail } = await supabase
        .from('customers')
        .select('*')
        .eq('email', user.email)
        .single()
      
      if (customerByEmail && !errorByEmail) {
        customer = customerByEmail
        console.log('🔍 Found customer by email')
      } else {
        error = errorByEmail
        console.log('❌ No customer found by email either')
      }
    }

    console.log('🔍 Customer API - Customer data:', customer)
    console.log('🔍 Customer API - is_existing_customer:', customer?.is_existing_customer)

    if (error) {
      console.error('❌ Customer API - Error fetching customer data:', error)
      return NextResponse.json({ error: 'Failed to fetch customer data' }, { status: 500 })
    }

    // Split the name field into first_name and last_name for the booking form
    if (customer && customer.name) {
      const nameParts = customer.name.trim().split(' ')
      customer.first_name = nameParts[0] || ''
      customer.last_name = nameParts.slice(1).join(' ') || ''
    }

    return NextResponse.json({ customer })
  } catch (error) {
    console.error('❌ Customer API - Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
