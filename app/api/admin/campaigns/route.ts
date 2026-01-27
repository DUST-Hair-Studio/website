import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, name, description, registrationUrl, customerType, subject, message, buttonText } = await request.json()

    if (!id || !name || !subject || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Save campaign to database
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        id,
        name,
        description,
        registration_url: registrationUrl,
        customer_type: customerType,
        subject,
        message,
        button_text: buttonText ?? '',
        is_active: true
      })
      .select()
      .single()

    if (campaignError) {
      console.error('Error creating campaign:', campaignError)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      campaign
    })

  } catch (error) {
    console.error('Campaign creation API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    // Transform database fields to match CampaignConfig interface
    const transformedCampaigns = (campaigns || []).map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description || '',
      registrationUrl: campaign.registration_url || '',
      customerType: campaign.customer_type || 'existing',
      isActive: campaign.is_active,
      buttonText: campaign.button_text ?? '',
      emailTemplate: {
        subject: campaign.subject || '',
        message: campaign.message || ''
      },
      tracking: {
        sourceField: 'campaign_source',
        registeredAtField: 'campaign_registered_at'
      },
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at
    }))

    return NextResponse.json({
      success: true,
      campaigns: transformedCampaigns
    })

  } catch (error) {
    console.error('Campaign fetch API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



