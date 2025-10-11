import { SupabaseStatus } from '@/components/debug/supabase-status'
import { GCalBlockedTime } from '@/components/debug/gcal-blocked-time'

export default function DebugPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Debug Tools</h1>
          <p className="text-gray-600 mt-2">
            Use these tools to diagnose system issues
          </p>
        </div>
        
        <GCalBlockedTime />
        
        <SupabaseStatus />
        
        <div className="text-center text-sm text-gray-500">
          <p>
            If you&apos;re experiencing issues, check the console logs and 
            run the diagnostics above to identify the problem.
          </p>
        </div>
      </div>
    </div>
  )
}
