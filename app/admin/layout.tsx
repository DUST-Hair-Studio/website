'use client'

import { AdminNavigation } from '@/components/admin/admin-navigation'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (loading) return
      
      if (!user) {
        router.push('/admin/login')
        return
      }

      try {
        const response = await fetch('/api/admin/check-access')
        const data = await response.json()
        
        if (response.ok && data.isAdmin) {
          setIsAdmin(true)
        } else {
          router.push('/admin/login')
        }
      } catch (error) {
        console.error('Error checking admin access:', error)
        router.push('/admin/login')
      } finally {
        setCheckingAdmin(false)
      }
    }

    checkAdminAccess()
  }, [user, loading, router])

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavigation />
      <main>{children}</main>
    </div>
  )
}
