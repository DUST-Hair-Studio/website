'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'

export function AdminNavigation() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  const navItems = [
    { href: '/admin/bookings', label: 'Bookings', icon: '📅' },
    { href: '/admin/customers', label: 'Customers', icon: '👥' },
    { href: '/admin/services', label: 'Services', icon: '✂️' },
    { href: '/admin/schedule', label: 'Schedule', icon: '🗓️' },
    { href: '/admin/reminders', label: 'Reminders', icon: '🔔' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/admin" className="text-xl font-bold text-gray-900">
                DUST Admin
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    isActive(item.href)
                      ? 'border-black text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
