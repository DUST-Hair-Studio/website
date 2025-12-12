import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get campaign analytics
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaign_registrations')
      .select('*')
      .order('created_at', { ascending: false })

    if (campaignError) {
      console.error('Error fetching campaign data:', campaignError)
      return NextResponse.json({ error: 'Failed to fetch campaign data' }, { status: 500 })
    }

    // Get total customers created from campaign
    const { data: campaignCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, email, campaign_source, campaign_registered_at, is_existing_customer')
      .not('campaign_source', 'is', null)

    if (customersError) {
      console.error('Error fetching campaign customers:', customersError)
    }

    // Calculate metrics
    const totalRegistrations = campaignData?.length || 0
    const totalCampaignCustomers = campaignCustomers?.length || 0
    const existingCustomers = campaignCustomers?.filter(c => c.is_existing_customer).length || 0

    return NextResponse.json({
      success: true,
      analytics: {
        totalRegistrations,
        totalCampaignCustomers,
        existingCustomers,
        newCustomers: totalCampaignCustomers - existingCustomers,
        campaignData: campaignData || [],
        campaignCustomers: campaignCustomers || []
      }
    })

  } catch (error) {
    console.error('Campaign analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



