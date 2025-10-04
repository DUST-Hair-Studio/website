import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Fetch all active services, ordered by sort_order
    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    console.log('🔍 Services API - Raw services from DB:', services)
    
    if (services) {
      services.forEach(service => {
        console.log(`🔍 Service: ${service.name}, is_existing_customer: ${service.is_existing_customer}, is_new_customer: ${service.is_new_customer}`)
      })
    }

    if (error) {
      console.error('❌ Services API - Error fetching services:', error)
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
    }

    return NextResponse.json({ services })
  } catch (error) {
    console.error('❌ Services API - Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
