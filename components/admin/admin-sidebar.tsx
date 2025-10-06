'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { useState } from 'react'
import { 
  Calendar, 
  Users, 
  Scissors, 
  Clock, 
  Bell, 
  Settings, 
  Menu,
  X,
  LogOut,
  Home
} from 'lucide-react'

export function AdminSidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const navItems = [
    { href: '/admin/bookings', label: 'Bookings', icon: Calendar },
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/services', label: 'Services', icon: Scissors },
    { href: '/admin/schedule', label: 'Schedule', icon: Clock },
    { href: '/admin/reminders', label: 'Reminders', icon: Bell },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <>
      {/* Mobile overlay */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-200 transition-all duration-300 flex flex-col
        ${isCollapsed ? 'w-16' : 'w-64'}
        lg:relative lg:z-auto lg:translate-x-0
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {!isCollapsed && (
            <h1 className="text-lg font-semibold" style={{ color: '#1C1C1D' }}>DUST Admin</h1>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2"
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {/* Back to Site Link */}
          <Link
            href="/"
            className={`
              flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
              text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-b border-gray-200 pb-3 mb-3
              ${isCollapsed ? 'justify-center' : ''}
            `}
          >
            <Home 
              style={isCollapsed ? 
                { width: '48px', height: '48px', strokeWidth: '4' } : 
                { width: '20px', height: '20px', marginRight: '12px', strokeWidth: '1.5' }
              }
            />
            {!isCollapsed && 'Back to Site'}
          </Link>
          
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive(item.href)
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                  ${isCollapsed ? 'justify-center' : ''}
                `}
              >
                <Icon 
                  style={isCollapsed ? 
                    { width: '48px', height: '48px', strokeWidth: '4' } : 
                    { width: '20px', height: '20px', marginRight: '12px', strokeWidth: '1.5' }
                  }
                />
                {!isCollapsed && item.label}
              </Link>
            )
          })}
        </nav>

        {/* User section - moved to bottom */}
        <div className="p-4 border-t border-gray-200 mt-auto">
          {!isCollapsed && (
            <div className="mb-3">
              <p className="text-sm text-gray-500">Signed in as</p>
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email}
              </p>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className={`
              w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100
              ${isCollapsed ? 'justify-center px-3' : ''}
            `}
          >
            <LogOut 
              style={isCollapsed ? 
                { width: '48px', height: '48px', strokeWidth: '4' } : 
                { width: '20px', height: '20px', marginRight: '12px', strokeWidth: '1.5' }
              }
            />
            {!isCollapsed && 'Sign Out'}
          </Button>
        </div>
      </div>
    </>
  )
}
