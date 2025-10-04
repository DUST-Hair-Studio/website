import { SupabaseStatus } from '@/components/debug/supabase-status'

export default function DebugPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Supabase Auth Debug</h1>
          <p className="text-gray-600 mt-2">
            Use this page to diagnose Supabase authentication issues
          </p>
        </div>
        
        <SupabaseStatus />
        
        <div className="text-center text-sm text-gray-500">
          <p>
            If you&apos;re experiencing hanging issues, check the console logs and 
            run the diagnostics above to identify the problem.
          </p>
        </div>
      </div>
    </div>
  )
}
