'use client'

import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  console.log('🔍 AdminLayout: Component is rendering!')
  
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)

  console.log('🔍 AdminLayout: loading=', loading, 'user=', user?.email, 'checkingAdmin=', checkingAdmin, 'isAdmin=', isAdmin)

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (loading) return
      
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
  }, [user, loading, router])

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

  return (
    <div className="h-screen flex" style={{ backgroundColor: '#FAFAFA' }}>
      <AdminSidebar />
      <main className="flex-1 lg:ml-0 flex flex-col overflow-hidden">
        <div className="p-3 sm:p-4 lg:p-6 flex-1 overflow-auto pt-16 lg:pt-6">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  )
}