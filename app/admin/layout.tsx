'use client'

import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import Link from 'next/link'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  console.log('🔍 AdminLayout: Component is rendering!')
  
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isAcceptInvitePage = pathname === '/admin/accept-invite'
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [gcalWarning, setGcalWarning] = useState<string | null>(null)
  const [gcalWarningDismissed, setGcalWarningDismissed] = useState(false)

  console.log('🔍 AdminLayout: loading=', loading, 'user=', user?.email, 'checkingAdmin=', checkingAdmin, 'isAdmin=', isAdmin)

  // Check Google Calendar health
  useEffect(() => {
    const checkGoogleCalendarHealth = async () => {
      try {
        const response = await fetch('/api/admin/google-calendar/health')
        const data = await response.json()
        
        if (data.connected && !data.healthy) {
          setGcalWarning(data.error || 'Google Calendar connection issue - please reconnect')
        } else {
          setGcalWarning(null)
        }
      } catch (error) {
        console.error('Error checking Google Calendar health:', error)
      }
    }

    // Check on mount and every 5 minutes
    checkGoogleCalendarHealth()
    const interval = setInterval(checkGoogleCalendarHealth, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (loading) return
      // Allow accept-invite page without auth - user gets session from invite link hash
      if (isAcceptInvitePage) {
        setCheckingAdmin(false)
        setIsAdmin(true) // Allow render
        return
      }

      if (!user) {
        setCheckingAdmin(false)
        router.push('/admin/login')
        return
      }

      try {
        const response = await fetch('/api/admin/check-access')
        const data = await response.json()
        
        if (response.ok && data.isAdmin) {
          setIsAdmin(true)
        } else {
          setIsAdmin(false)
          router.push('/admin/login')
        }
      } catch (error) {
        console.error('Error checking admin access:', error)
        setIsAdmin(false)
        router.push('/admin/login')
      } finally {
        setCheckingAdmin(false)
      }
    }

    checkAdminAccess()
  }, [user, loading, router, isAcceptInvitePage])

  // Temporary bypass for debugging
  const forceShowContent = true

  if ((loading || checkingAdmin) && !forceShowContent) {
    console.log('🔍 AdminLayout: Showing loading spinner - loading:', loading, 'checkingAdmin:', checkingAdmin)
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: '#FAFAFA' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <div className="text-sm text-gray-600">
            Loading... (loading: {loading.toString()}, checkingAdmin: {checkingAdmin.toString()})
          </div>
          <div className="mt-4">
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Force Reload
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin && !forceShowContent) {
    console.log('🔍 AdminLayout: User is not admin, returning null')
    return null
  }

  // Accept-invite page: minimal layout, no sidebar (user may not be logged in yet)
  if (isAcceptInvitePage) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FAFAFA' }}>
        {children}
        <Toaster />
      </div>
    )
  }

  return (
    <div className="h-screen flex" style={{ backgroundColor: '#FAFAFA' }}>
      <AdminSidebar />
      <main className="flex-1 lg:ml-0 flex flex-col overflow-hidden">
        {/* Google Calendar Warning Banner */}
        {gcalWarning && !gcalWarningDismissed && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between lg:mt-0 mt-14">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span className="text-sm text-amber-800">
                <strong>Google Calendar:</strong> {gcalWarning}
              </span>
              <Link 
                href="/admin/settings" 
                className="ml-2 text-sm font-medium text-amber-700 hover:text-amber-900 underline"
              >
                Go to Settings →
              </Link>
            </div>
            <button 
              onClick={() => setGcalWarningDismissed(true)}
              className="text-amber-600 hover:text-amber-800 p-1"
              aria-label="Dismiss warning"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-3 sm:p-4 lg:p-6 flex-1 overflow-auto pt-16 lg:pt-6">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  )
}