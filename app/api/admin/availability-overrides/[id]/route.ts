import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// DELETE an availability override by id
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminSupabaseClient()

    const { error } = await supabase
      .from('availability_overrides')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting availability override:', error)
      return NextResponse.json({ error: 'Failed to delete override' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Availability override DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
