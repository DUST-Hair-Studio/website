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
  Home,
  ListChecks
} from 'lucide-react'

export function AdminSidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(true) // Start collapsed on mobile
  const [isMobile, setIsMobile] = useState(false)
  const [waitlistEnabled, setWaitlistEnabled] = useState(true)
  const [unreadWaitlistCount, setUnreadWaitlistCount] = useState(0)

  // Fetch waitlist setting and unread count
  useEffect(() => {
    const fetchWaitlistSetting = async () => {
      try {
        const response = await fetch('/api/admin/settings')
        if (response.ok) {
          const data = await response.json()
          setWaitlistEnabled(data.waitlist?.enabled !== false) // Default to true if not set
        }
      } catch (error) {
        console.error('Error fetching waitlist setting:', error)
        // Default to enabled if there's an error
        setWaitlistEnabled(true)
      }
    }
    
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/admin/waitlist/unread-count')
        if (response.ok) {
          const data = await response.json()
          console.log('🔔 [WAITLIST BADGE] Fetched unread count:', data)
          setUnreadWaitlistCount(data.unreadCount || 0)
        } else {
          // Log full error details to help debug
          const errorText = await response.text()
          console.error('🔔 [WAITLIST BADGE] Failed to fetch unread count:', response.status, errorText)
          try {
            const errorData = JSON.parse(errorText)
            console.error('🔔 [WAITLIST BADGE] Error details:', errorData)
          } catch {
          // Couldn't parse as JSON, already logged as text
        }
        // Set count to 0 on error to prevent UI issues
        setUnreadWaitlistCount(0)
      }
    } catch {
      console.error('🔔 [WAITLIST BADGE] Error fetching unread waitlist count')
      // Set count to 0 on error to prevent UI issues
      setUnreadWaitlistCount(0)
      }
    }
    
    fetchWaitlistSetting()
    fetchUnreadCount()
    
    // Refresh unread count every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const baseNavItems = [
    { href: '/admin/bookings', label: 'Bookings', icon: Calendar },
    { href: '/admin/waitlist', label: 'Waitlist', icon: ListChecks },
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/services', label: 'Services', icon: Scissors },
    { href: '/admin/schedule', label: 'Schedule', icon: Clock },
    { href: '/admin/reminders', label: 'Reminders', icon: Bell },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ]

  // Filter nav items based on waitlist setting
  const navItems = baseNavItems.filter(item => {
    if (item.href === '/admin/waitlist') {
      return waitlistEnabled
    }
    return true
  })

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
            <h1 className="text-2xl font-bold" style={{ color: '#1C1C1D' }}>
              <span className="font-extrabold">DUST</span>
              <span className="font-normal text-gray-400 text-lg ml-1">Studio</span>
            </h1>
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
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`
                  flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors relative
                  ${isActive(item.href)
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }
                  ${isCollapsed ? 'justify-center' : ''} ${touchTargetSize}
                `}
              >
                {/* Icon with notification badge container (only for collapsed state) */}
                {isCollapsed ? (
                  <div className="relative">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                    
                    {/* Notification Badge for Waitlist - Collapsed State */}
                    {item.href === '/admin/waitlist' && unreadWaitlistCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] px-1">
                        {unreadWaitlistCount > 99 ? '99+' : unreadWaitlistCount}
                      </span>
                    )}
                  </div>
                ) : (
                  /* Expanded State - Icon without badge */
                  <Icon className="h-5 w-5 mr-3" strokeWidth={1.5} />
                )}
                
                {/* Text and Badge for Expanded State */}
                {!isCollapsed && (
                  <>
                    {item.label}
                    {/* Notification Badge for Waitlist - Expanded State */}
                    {item.href === '/admin/waitlist' && unreadWaitlistCount > 0 && (
                      <span className="ml-auto flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] px-1">
                        {unreadWaitlistCount > 99 ? '99+' : unreadWaitlistCount}
                      </span>
                    )}
                  </>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User section - moved to bottom */}
        <div className="p-4 border-t border-gray-200 mt-auto">
          {/* Back to Site Link */}
          <Link
            href="/"
            onClick={handleNavClick}
            className={`
              flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors
              text-gray-700 hover:bg-gray-100 hover:text-gray-900 mb-3
              ${isCollapsed ? 'justify-center' : ''} ${touchTargetSize}
            `}
          >
            <Home className={`${iconSize} ${isCollapsed ? '' : 'mr-3'}`} strokeWidth={iconStrokeWidth} />
            {!isCollapsed && 'Back to Site'}
          </Link>
          
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