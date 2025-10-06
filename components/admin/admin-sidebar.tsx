'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { useState, useEffect } from 'react'
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
  const [isCollapsed, setIsCollapsed] = useState(true) // Start collapsed on mobile
  const [isMobile, setIsMobile] = useState(false)

  const navItems = [
    { href: '/admin/bookings', label: 'Bookings', icon: Calendar },
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/services', label: 'Services', icon: Scissors },
    { href: '/admin/schedule', label: 'Schedule', icon: Clock },
    { href: '/admin/reminders', label: 'Reminders', icon: Bell },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ]

  const isActive = (href: string) => pathname === href

  // Consistent icon sizing - all icons should be large and visible
  const iconSize = isCollapsed ? 'h-10 w-10' : 'h-5 w-5'
  const iconStrokeWidth = isCollapsed ? 2.5 : 1.5
  
  // Mobile-friendly touch targets
  const touchTargetSize = 'min-h-[44px] min-w-[44px]'
  
  // Handle navigation click - close sidebar on mobile
  const handleNavClick = () => {
    if (isMobile) {
      setIsCollapsed(true)
    }
  }
  
  // Handle window resize to ensure proper mobile behavior
  useEffect(() => {
    const handleResize = () => {
      const isMobileSize = window.innerWidth < 1024 // lg breakpoint
      setIsMobile(isMobileSize)
      
      if (isMobileSize) {
        setIsCollapsed(true) // Always collapsed on mobile
      } else {
        setIsCollapsed(false) // Expanded on desktop
      }
    }
    
    // Set initial state based on screen size
    handleResize()
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <>
      {/* Mobile menu button - always visible on mobile */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`
          fixed top-4 left-4 z-50 lg:hidden ${touchTargetSize}
          bg-white border border-gray-200 shadow-lg
        `}
      >
        <Menu className="h-6 w-6" strokeWidth={2} />
      </Button>

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
        ${isCollapsed ? (isMobile ? 'w-0' : 'w-20') : 'w-64'}
        lg:relative lg:z-auto lg:translate-x-0
        ${isCollapsed && isMobile ? '-translate-x-full' : 'translate-x-0'}
        ${isMobile && isCollapsed ? 'hidden' : ''}
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
            className={`p-2 ${isCollapsed ? 'mx-auto' : ''} ${touchTargetSize}`}
          >
            {isCollapsed ? (
              <Menu className="h-10 w-10" strokeWidth={2.5} />
            ) : (
              <X className="h-5 w-5" strokeWidth={1.5} />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-3">
          {/* Back to Site Link */}
          <Link
            href="/"
            onClick={handleNavClick}
            className={`
              flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors
              text-gray-700 hover:bg-gray-100 hover:text-gray-900 border-b border-gray-200 pb-4 mb-4
              ${isCollapsed ? 'justify-center' : ''} ${touchTargetSize}
            `}
          >
            <Home className={`${iconSize} ${isCollapsed ? '' : 'mr-3'}`} strokeWidth={iconStrokeWidth} />
            {!isCollapsed && 'Back to Site'}
          </Link>
          
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`
                  flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors
                  ${isActive(item.href)
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                  ${isCollapsed ? 'justify-center' : ''} ${touchTargetSize}
                `}
              >
                <Icon className={`${iconSize} ${isCollapsed ? '' : 'mr-3'}`} strokeWidth={iconStrokeWidth} />
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
              w-full justify-start text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-3 py-3
              ${isCollapsed ? 'justify-center' : ''} ${touchTargetSize}
            `}
          >
            <LogOut className={`${iconSize} ${isCollapsed ? '' : 'mr-3'}`} strokeWidth={iconStrokeWidth} />
            {!isCollapsed && 'Sign Out'}
          </Button>
        </div>
      </div>
    </>
  )
}