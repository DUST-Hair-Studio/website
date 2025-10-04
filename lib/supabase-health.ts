import { createClient } from './supabase'

export interface SupabaseHealthStatus {
  isConnected: boolean
  error?: string
  responseTime?: number
  projectStatus?: string
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  const startTime = Date.now()
  const supabase = createClient()

  try {
    console.log('🔍 Checking Supabase connection health...')
    
    // Simple health check - try to get the current user
    const { data, error } = await supabase.auth.getUser()
    
    const responseTime = Date.now() - startTime
    
    if (error && error.message.includes('timed out')) {
      return {
        isConnected: false,
        error: 'Connection timed out',
        responseTime
      }
    }
    
    // Even if there's no user (which is normal), the connection is working
    return {
      isConnected: true,
      responseTime,
      projectStatus: 'Connected'
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    console.error('❌ Supabase health check failed:', error)
    
    return {
      isConnected: false,
      error: error.message || 'Unknown connection error',
      responseTime
    }
  }
}

export async function testSupabaseAuth(): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  
  try {
    console.log('🔍 Testing Supabase auth functionality...')
    
    // Test auth state change listener (this should work immediately)
    let listenerCalled = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      listenerCalled = true
      console.log('✅ Auth state change listener working:', event)
    })
    
    // Wait a bit to see if listener gets called
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    subscription.unsubscribe()
    
    if (listenerCalled) {
      return { success: true }
    } else {
      return { success: false, error: 'Auth state listener not responding' }
    }
  } catch (error: any) {
    console.error('❌ Supabase auth test failed:', error)
    return { 
      success: false, 
      error: error.message || 'Auth test failed' 
    }
  }
}
