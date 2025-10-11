'use client'

import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function Navigation() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const [customer, setCustomer] = useState<{ is_existing_customer: boolean; name?: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isProfileDropdownOpen) {
        // Check if the click is outside the dropdown
        const dropdown = document.querySelector('[data-dropdown="profile"]')
        if (dropdown && !dropdown.contains(event.target as Node)) {
          setIsProfileDropdownOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isProfileDropdownOpen])

  // Fetch customer data and check admin status when user is available
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setCustomer(null)
        setIsAdmin(false)
        return
      }

      try {
        // Fetch customer data
        const customerResponse = await fetch('/api/customer/me')
        const customerData = await customerResponse.json()
        
        if (customerData.customer) {
          setCustomer(customerData.customer)
        }

        // Check admin status
        const adminResponse = await fetch('/api/admin/check-access')
        const adminData = await adminResponse.json()
        
        setIsAdmin(adminData.isAdmin || false)
      } catch (error) {
        console.error('Error fetching user data:', error)
        setIsAdmin(false)
      }
    }

    fetchUserData()
  }, [user])

  if (loading) {
    return (
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="dust-heading text-xl font-bold tracking-narrow" style={{ color: '#1C1C1D' }}>
                DUST
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <div className="animate-pulse bg-gray-200 h-8 w-20 rounded"></div>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  const isLoggedIn = !!user

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="dust-heading text-xl font-bold tracking-narrow" style={{ color: '#1C1C1D' }}>
              DUST
            </Link>
            <span className="ml-2 text-sm text-gray-500 hidden sm:inline">Studio</span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {isLoggedIn ? (
              <>
                {!isAdmin && (
                  <>
                    <Link href="/appointments">
                      <Button variant="outline" className="border-black text-black hover:bg-gray-100">
                        Manage Bookings
                      </Button>
                    </Link>
                    <Link href="/waitlist">
                      <Button variant="ghost" className="text-black hover:bg-gray-100">
                        Waitlist
                      </Button>
                    </Link>
                  </>
                )}
                {isAdmin && (
                  <Link href="/admin">
                    <Button variant="outline" className="border-black text-black hover:bg-gray-100">
                      Admin Portal
                    </Button>
                  </Link>
                )}
                <div className="relative" data-dropdown="profile">
                  <button
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-full border border-black transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isProfileDropdownOpen && (
                    <div className="absolute right-0 mt-3 w-64 bg-white rounded-lg shadow-xl py-4 z-50 border border-gray-200">
                      <div className="px-6 py-4 text-sm text-gray-600 border-b border-gray-100">
                        <div className="font-medium text-gray-900">{user?.email}</div>
                        <div className="text-xs text-gray-500 mt-1">Account</div>
                      </div>
                      <button
                        onClick={async () => {
                          if (isSigningOut) return
                          setIsSigningOut(true)
                          try {
                            await signOut()
                            setIsProfileDropdownOpen(false)
                            router.push('/')
                          } catch (error) {
                            console.error('Sign out error:', error)
                          } finally {
                            setIsSigningOut(false)
                          }
                        }}
                        disabled={isSigningOut}
                        className="w-full text-left px-6 py-4 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center">
                <Link href="/login">
                  <Button variant="outline">Sign In</Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-black hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-gray-500"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger icon */}
              <svg className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {/* Close icon */}
              <svg className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
              {isLoggedIn ? (
                <>
                  {!isAdmin && (
                    <>
                      <Link 
                        href="/appointments" 
                        className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Manage Bookings
                      </Link>
                      <Link 
                        href="/waitlist" 
                        className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Waitlist
                      </Link>
                    </>
                  )}
                  {isAdmin && (
                    <Link 
                      href="/admin" 
                      className="block px-3 py-2 text-base font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Admin Portal
                    </Link>
                  )}
                  <div className="px-3 py-2">
                    <div className="mb-4"></div>
                    <button
                      onClick={async () => {
                        if (isSigningOut) return
                        setIsSigningOut(true)
                        try {
                          await signOut()
                          setIsMobileMenuOpen(false)
                          router.push('/')
                        } catch (error) {
                          console.error('🔍 Mobile sign out error:', error)
                        } finally {
                          setIsSigningOut(false)
                        }
                      }}
                      disabled={isSigningOut}
                      className="flex items-center justify-center w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-base font-medium text-gray-900 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {isSigningOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                  </div>
                </>
              ) : (
                <Link 
                  href="/login" 
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
