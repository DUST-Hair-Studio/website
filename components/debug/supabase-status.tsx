'use client'

import { useState, useEffect } from 'react'
import { checkSupabaseHealth, testSupabaseAuth, SupabaseHealthStatus } from '@/lib/supabase-health'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function SupabaseStatus() {
  const [healthStatus, setHealthStatus] = useState<SupabaseHealthStatus | null>(null)
  const [authTest, setAuthTest] = useState<{ success: boolean; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const runDiagnostics = async () => {
    setLoading(true)
    setHealthStatus(null)
    setAuthTest(null)

    try {
      console.log('🔍 Running Supabase diagnostics...')
      
      // Run health check
      const health = await checkSupabaseHealth()
      setHealthStatus(health)
      
      // Run auth test
      const auth = await testSupabaseAuth()
      setAuthTest(auth)
      
      console.log('✅ Diagnostics complete:', { health, auth })
    } catch (error) {
      console.error('❌ Diagnostics failed:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runDiagnostics()
  }, [])

  const getStatusColor = (isConnected: boolean) => {
    return isConnected ? 'text-green-600' : 'text-red-600'
  }

  const getStatusIcon = (isConnected: boolean) => {
    return isConnected ? '✅' : '❌'
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔧 Supabase Connection Diagnostics
          <Button 
            onClick={runDiagnostics} 
            disabled={loading}
            size="sm"
            variant="outline"
          >
            {loading ? 'Testing...' : 'Refresh'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Health */}
        <div className="space-y-2">
          <h3 className="font-semibold">Connection Health</h3>
          {healthStatus ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getStatusIcon(healthStatus.isConnected)}</span>
                <span className={getStatusColor(healthStatus.isConnected)}>
                  {healthStatus.isConnected ? 'Connected' : 'Disconnected'}
                </span>
                {healthStatus.responseTime && (
                  <span className="text-sm text-gray-500">
                    ({healthStatus.responseTime}ms)
                  </span>
                )}
              </div>
              {healthStatus.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  Error: {healthStatus.error}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">Testing connection...</div>
          )}
        </div>

        {/* Auth Functionality */}
        <div className="space-y-2">
          <h3 className="font-semibold">Auth Functionality</h3>
          {authTest ? (
            <div className="flex items-center gap-2">
              <span className="text-xl">{getStatusIcon(authTest.success)}</span>
              <span className={getStatusColor(authTest.success)}>
                {authTest.success ? 'Working' : 'Not Working'}
              </span>
              {authTest.error && (
                <span className="text-sm text-red-600">({authTest.error})</span>
              )}
            </div>
          ) : (
            <div className="text-gray-500">Testing auth...</div>
          )}
        </div>

        {/* Environment Variables Check */}
        <div className="space-y-2">
          <h3 className="font-semibold">Environment Variables</h3>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span>{process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌'}</span>
              <span>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>{process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌'}</span>
              <span>NEXT_PUBLIC_SUPABASE_ANON_KEY: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}</span>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="space-y-2">
          <h3 className="font-semibold">Recommendations</h3>
          <div className="text-sm space-y-1">
            {!healthStatus?.isConnected && (
              <div className="text-red-600">
                • Check your internet connection
                • Verify Supabase project is not paused
                • Check Supabase project status at supabase.com
              </div>
            )}
            {healthStatus?.isConnected && healthStatus.responseTime && healthStatus.responseTime > 5000 && (
              <div className="text-yellow-600">
                • Connection is slow ({healthStatus.responseTime}ms) - this may cause timeouts
              </div>
            )}
            {healthStatus?.isConnected && authTest?.success && (
              <div className="text-green-600">
                • Supabase connection is working properly
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
