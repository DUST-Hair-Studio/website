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
    const { error } = await supabase.auth.getUser()
    
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
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime
    console.error('❌ Supabase health check failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return {
      isConnected: false,
      error: errorMessage || 'Unknown connection error',
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
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
  } catch (error: unknown) {
    console.error('❌ Supabase auth test failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { 
      success: false, 
      error: errorMessage || 'Auth test failed' 
    }
  }
}
