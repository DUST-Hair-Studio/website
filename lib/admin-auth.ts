import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Verifies the caller is a signed-in, active admin.
 * Returns the admin's email, or a 401/403 response to return as-is.
 */
export async function requireAdmin(): Promise<{ email: string } | { response: NextResponse }> {
  const supabase = await createServerSupabaseClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user?.email) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', user.email)
    .eq('is_active', true)
    .single()

  if (adminError || !adminUser) {
    return { response: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }) }
  }

  return { email: user.email }
}
