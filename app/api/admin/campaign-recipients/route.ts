import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET campaign recipient counts and email lists for All, Existing, and New customers.
 * Used by the campaign send UI to show group counts and to resolve recipient lists.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, email, is_existing_customer')
      .not('email', 'is', null)

    if (error) {
      console.error('Error fetching campaign recipients:', error)
      return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 })
    }

    const list = (customers || []) as Array<{ email: string | null; is_existing_customer: boolean }>
    const normalize = (e: string) => e.trim().toLowerCase()
    const valid = (e: string) => e && e.includes('@')

    const allEmails = [...new Set(list.filter(c => c.email && valid(c.email)).map(c => normalize(c.email!)))]
    const existingEmails = [...new Set(list.filter(c => c.email && valid(c.email) && c.is_existing_customer).map(c => normalize(c.email!)))]
    const newEmails = [...new Set(list.filter(c => c.email && valid(c.email) && !c.is_existing_customer).map(c => normalize(c.email!)))]

    return NextResponse.json({
      allCount: allEmails.length,
      existingCount: existingEmails.length,
      newCount: newEmails.length,
      allEmails,
      existingEmails,
      newEmails
    })
  } catch (err) {
    console.error('Campaign recipients API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
