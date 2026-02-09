'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminSchedulePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/settings?tab=schedule')
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <p className="text-gray-500">Redirecting to schedule settings…</p>
    </div>
  )
}
