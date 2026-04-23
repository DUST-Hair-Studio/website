'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { useState, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  Calendar,
  Home,
  Layers,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  Scissors,
  Settings,
  Users,
  X,
} from 'lucide-react'

const settingsItem = {
  href: '/admin/settings',
  label: 'Settings',
  icon: Settings,
} as const

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

    // Refresh unread count every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [])

  const mainNavBase: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/admin/bookings', label: 'Bookings', icon: Calendar },
    { href: '/admin/waitlist', label: 'Waitlist', icon: ListChecks },
    { href: '/admin/customers', label: 'Customers', icon: Users },
    { href: '/admin/services', label: 'Services', icon: Scissors },
    { href: '/admin/reminders', label: 'Reminders', icon: Bell },
    { href: '/admin/segments', label: 'Segments', icon: Layers },
    { href: '/admin/campaigns', label: 'Campaigns', icon: Mail },
  ]

  // Filter nav items based on waitlist setting
  const mainNavItems = mainNavBase.filter((item) => {
    if (item.href === '/admin/waitlist') {
      return waitlistEnabled
    }
    return true
  })

  const isActive = (href: string) => pathname === href

  // Mobile-friendly touch targets
  const touchTargetSize = 'min-h-11 min-w-[44px]'

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

  const navLinkClass = (active: boolean, collapsed: boolean) => `
    flex items-center px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] transition-colors relative rounded-none border-0
    ${active ? 'bg-black text-white' : 'text-black hover:bg-neutral-100'}
    ${collapsed ? 'justify-center' : ''} ${touchTargetSize}
  `

  const renderNavItem = (item: (typeof mainNavBase)[0]) => {
    const Icon = item.icon
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={handleNavClick}
        className={navLinkClass(active, isCollapsed)}
      >
        {isCollapsed ? (
          <div className="relative">
            <Icon
              className={`h-5 w-5 ${active ? 'text-white' : 'text-black'}`}
              strokeWidth={1.5}
            />
            {item.href === '/admin/waitlist' && unreadWaitlistCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold leading-none text-white">
                {unreadWaitlistCount > 99 ? '99+' : unreadWaitlistCount}
              </span>
            )}
          </div>
        ) : null}

        {!isCollapsed && (
          <>
            {item.label}
            {item.href === '/admin/waitlist' && unreadWaitlistCount > 0 && (
              <span className="ml-auto flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadWaitlistCount > 99 ? '99+' : unreadWaitlistCount}
              </span>
            )}
          </>
        )}
      </Link>
    )
  }

  const SettingsIcon = settingsItem.icon
  const settingsActive = isActive(settingsItem.href)

  return (
    <>
      {/* Mobile menu button - always visible on mobile */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`
          fixed top-4 left-4 z-50 lg:hidden ${touchTargetSize}
          border border-black bg-[#FAFAFA] text-black shadow-lg hover:bg-neutral-100
        `}
      >
        <Menu className="h-6 w-6" strokeWidth={2} />
      </Button>

      {/* Mobile overlay */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed top-0 left-0 z-50 flex h-full flex-col border-r border-black bg-[#FAFAFA] transition-all duration-300
        ${isCollapsed ? (isMobile ? 'w-0' : 'w-20') : 'w-64'}
        lg:relative lg:z-auto lg:translate-x-0
        ${isCollapsed && isMobile ? '-translate-x-full' : 'translate-x-0'}
        ${isMobile && isCollapsed ? 'hidden' : ''}
      `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black p-3">
          {!isCollapsed && (
            <div className="min-w-0 flex-1 mr-2">
              <Image
                src="/backend_images/studiostudio-logo.svg"
                alt="Studio"
                width={219}
                height={90}
                className="h-9 w-auto max-w-full object-contain object-left"
                priority
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 text-black hover:bg-neutral-100 ${isCollapsed ? 'mx-auto' : ''} ${touchTargetSize}`}
          >
            {isCollapsed ? (
              <Menu className="h-10 w-10" strokeWidth={2.5} />
            ) : (
              <X className="h-5 w-5" strokeWidth={1.5} />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0 p-3">{mainNavItems.map((item) => renderNavItem(item))}</nav>

        {/* Footer: Settings, account, back to site, sign out (order matches reference) */}
        <div className="mt-auto space-y-0 border-t border-black p-3">
          <Link
            href={settingsItem.href}
            onClick={handleNavClick}
            className={navLinkClass(settingsActive, isCollapsed)}
          >
            {isCollapsed ? (
              <div className="relative">
                <SettingsIcon
                  className={`h-5 w-5 ${settingsActive ? 'text-white' : 'text-black'}`}
                  strokeWidth={1.5}
                />
              </div>
            ) : (
              <SettingsIcon
                className={`mr-2.5 h-5 w-5 shrink-0 ${settingsActive ? 'text-white' : 'text-black'}`}
                strokeWidth={1.5}
              />
            )}
            {!isCollapsed && settingsItem.label}
          </Link>

          {!isCollapsed && (
            <div className="px-1 py-2">
              <p className="text-sm text-black">Signed in as</p>
              <p className="font-mono text-sm text-black truncate">{user?.email}</p>
            </div>
          )}

          <button
            type="button"
            onClick={signOut}
            className={`
              flex w-full items-center border border-black bg-white px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-black transition-colors
              hover:bg-neutral-50
              ${isCollapsed ? 'min-h-11 min-w-[44px] justify-center' : 'justify-start'}
            `}
          >
            {isCollapsed ? (
              <LogOut className="h-5 w-5" strokeWidth={1.5} />
            ) : (
              'Sign Out'
            )}
          </button>

          <Link
            href="/"
            onClick={handleNavClick}
            className={navLinkClass(false, isCollapsed)}
          >
            {isCollapsed ? (
              <Home className="h-5 w-5 text-black" strokeWidth={1.5} />
            ) : (
              'Back to Site'
            )}
          </Link>
        </div>
      </div>
    </>
  )
}
