import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
    }

    // Delete campaign from database
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId)

    if (deleteError) {
      console.error('Error deleting campaign:', deleteError)
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Campaign deleted successfully'
    })

  } catch (error) {
    console.error('Campaign deletion API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: campaignId } = await params

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
    }

    // Get specific campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError) {
      console.error('Error fetching campaign:', campaignError)
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      campaign
    })

  } catch (error) {
    console.error('Campaign fetch API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('PATCH campaign - Starting...')
  
  let campaignId: string | undefined
  let body: Record<string, unknown> | undefined
  
  try {
    // Parse params first
    const resolvedParams = await params
    campaignId = resolvedParams.id
    console.log('PATCH campaign - Campaign ID:', campaignId)
    
    // Parse body
    body = await request.json()
    console.log('PATCH campaign - Body:', body)
    
    const supabase = await createServerSupabaseClient()
    console.log('PATCH campaign - Supabase client created')
    
    // Check admin authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('PATCH campaign - Auth check:', { user: user?.email, authError })
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Destructure, ignoring 'id' from body since we use URL param
    const { name, description, registrationUrl, customerType, subject, message, buttonText } = body as {
      name?: string
      description?: string
      registrationUrl?: string
      customerType?: string
      subject?: string
      message?: string
      buttonText?: string
    }

    console.log('PATCH campaign request:', { campaignId, body })

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
    }

    // Build update object with snake_case field names
    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }
    
    if (name !== undefined) updateFields.name = name
    if (description !== undefined) updateFields.description = description
    if (registrationUrl !== undefined) updateFields.registration_url = registrationUrl
    if (customerType !== undefined) updateFields.customer_type = customerType
    if (subject !== undefined) updateFields.subject = subject
    if (message !== undefined) updateFields.message = message
    if (buttonText !== undefined) updateFields.button_text = buttonText

    console.log('Update fields:', updateFields)

    // First check if campaign exists
    const { data: existingCampaign, error: checkError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .single()

    if (checkError || !existingCampaign) {
      console.error('Campaign not found:', campaignId, checkError)
      return NextResponse.json({ 
        error: 'Campaign not found', 
        details: `No campaign exists with ID: ${campaignId}` 
      }, { status: 404 })
    }

    // Update campaign in database
    const { data: campaign, error: updateError } = await supabase
      .from('campaigns')
      .update(updateFields)
      .eq('id', campaignId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating campaign:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update campaign', 
        details: updateError.message,
        code: updateError.code 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      campaign
    })

  } catch (error) {
    console.error('Campaign update API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { message: errorMessage, stack: errorStack })
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: errorMessage 
    }, { status: 500 })
  }
}



