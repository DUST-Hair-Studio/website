'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal } from '@/components/ui/dropdown-menu'
import { CheckCircle, Calendar, DollarSign, CalendarDays, RotateCcw, Search, Filter, Table, Phone, MessageSquare, Mail, ListChecks, CreditCard, MoreVertical, CheckSquare, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import RescheduleModal from '@/components/admin/reschedule-modal'

interface BookingWithDetails extends Booking {
  services: {
    name: string;
    description?: string;
    duration_minutes: number;
    new_customer_price?: number;
    existing_customer_price?: number;
  } | null;
  customers: {
    name: string;
    email: string;
    phone: string;
    is_existing_customer?: boolean;
  };
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [timeFilter, setTimeFilter] = useState<string>('upcoming')
  const [paymentFilter, setPaymentFilter] = useState<string>('all')
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null)
  const [showBookingDetails, setShowBookingDetails] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [bookingToReschedule, setBookingToReschedule] = useState<BookingWithDetails | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [calendarView, setCalendarView] = useState<'3day' | 'week' | 'month'>('month')
  const [calendarStartDate, setCalendarStartDate] = useState<Date>(new Date())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(undefined)
  const [activePhoneMenu, setActivePhoneMenu] = useState<string | null>(null)
  const [processingPayment, setProcessingPayment] = useState<Set<string>>(new Set())
  const [waitlistCount, setWaitlistCount] = useState(0)

  // Close phone menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActivePhoneMenu(null)
    }
    
    if (activePhoneMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [activePhoneMenu])

  // Fetch waitlist count (only notified and pending statuses)
  const fetchWaitlistCount = async () => {
    try {
      const response = await fetch('/api/admin/waitlist?status=notified,pending')
      const data = await response.json()
      setWaitlistCount(data.waitlist?.length || 0)
    } catch (error) {
      console.error('Error fetching waitlist count:', error)
    }
  }

  // Send payment link via email
  const sendPaymentLinkEmail = async (booking: BookingWithDetails) => {
    try {
      // Add booking to processing set
      setProcessingPayment(prev => new Set(prev).add(booking.id))
      
      const response = await fetch('/api/bookings/send-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: booking.id,
          serviceName: booking.services?.name || 'Service',
          price: booking.price_charged,
          customerEmail: booking.customers.email,
          customerPhone: booking.customers.phone,
          customerName: booking.customers.name
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send payment link')
      }

      const data = await response.json()
      
      if (data.emailSent) {
        toast.success('Payment link sent!', {
          description: `Payment link has been sent to ${booking.customers.email}`
        })
      } else {
        toast.warning('Payment link generated but email failed', {
          description: 'Payment link was created but could not be sent via email. You can copy the link manually.'
        })
      }
    } catch (error) {
      console.error('Error sending payment link:', error)
      toast.error('Failed to send payment link', {
        description: 'Please try again or check your email configuration.'
      })
    } finally {
      // Remove booking from processing set
      setProcessingPayment(prev => {
        const newSet = new Set(prev)
        newSet.delete(booking.id)
        return newSet
      })
    }
  }

  // Generate payment link for a booking (legacy function - opens in new tab)
  const generatePaymentLink = async (booking: BookingWithDetails) => {
    try {
      // Add booking to processing set
      setProcessingPayment(prev => new Set(prev).add(booking.id))
      
      const response = await fetch('/api/bookings/generate-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: booking.id,
          serviceName: booking.services?.name || 'Service',
          price: booking.price_charged,
          customerEmail: booking.customers.email,
          customerPhone: booking.customers.phone,
          customerName: booking.customers.name
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate payment link')
      }

      const data = await response.json()
      
      // Open the payment link in a new tab
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank')
        toast.success('Payment link generated!', {
          description: 'The payment page has opened in a new tab.'
        })
      }
    } catch (error) {
      console.error('Error generating payment link:', error)
      toast.error('Failed to generate payment link', {
        description: 'Please try again or check your Square configuration.'
      })
    } finally {
      // Remove booking from processing set
      setProcessingPayment(prev => {
        const newSet = new Set(prev)
        newSet.delete(booking.id)
        return newSet
      })
    }
  }

  // Create Square order for POS payment
  const createSquareOrderForPOS = async (booking: BookingWithDetails) => {
    try {
      const response = await fetch('/api/bookings/create-pos-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: booking.id
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create Square order')
      }

      // Open Square POS app automatically
      if (data.posUrl) {
        // Try to open the Square POS app
        try {
          // First try to open in new tab/window
          const posWindow = window.open(data.posUrl, '_blank')
          
          // If that doesn't work (popup blocked), try direct navigation
          setTimeout(() => {
            if (!posWindow || posWindow.closed) {
              // Popup was blocked, try direct navigation
              window.location.href = data.posUrl
            }
          }, 100)
          
          toast.success('Opening Square POS...', {
            description: `Square POS app should open automatically with payment details.`
          })
        } catch (error) {
          // Fallback: show POS URL and copy to clipboard
          navigator.clipboard.writeText(data.posUrl).then(() => {
            toast.success('POS URL copied to clipboard!', {
              description: `POS URL copied. You can paste this into your browser to open Square POS.`
            })
          }).catch(() => {
            toast.success('Square POS URL generated!', {
              description: `POS URL: ${data.posUrl.substring(0, 50)}...`
            })
          })
        }
      } else {
        // Fallback: show error if POS URL not available
        toast.error('Failed to generate POS URL', {
          description: 'Please check your Square settings and try again.'
        })
      }

      // No need to update local state since we're not creating orders
    } catch (error) {
      console.error('Error generating Square POS URL:', error)
      toast.error('Failed to generate Square POS URL', {
        description: 'Please try again.'
      })
    }
  }

  // Handle Square POS callback data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const data = urlParams.get('data')
    
    if (data) {
      try {
        const transactionInfo = JSON.parse(decodeURIComponent(data))
        
        if (transactionInfo.error_code === 'payment_canceled') {
          toast.info('Payment was canceled', {
            description: 'You can try again by clicking "Pay Now (POS)"'
          })
        } else if (transactionInfo.transaction_id) {
          toast.success('Payment completed!', {
            description: 'The booking has been updated with payment details'
          })
        }
        
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname)
      } catch (error) {
        console.error('Error parsing Square POS callback:', error)
      }
    }
  }, [])

  // Fetch all bookings
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await fetch('/api/admin/bookings')
        const data = await response.json()
        setBookings(data.bookings || [])
      } catch (error) {
        console.error('Error fetching bookings:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
    fetchWaitlistCount()
  }, [])

  // Helper function to check if a date is upcoming
  const isUpcoming = (date: string) => {
    // Treat the date string as local time, not UTC
    const bookingDate = new Date(date + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return bookingDate >= today
  }

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.customers.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customers.phone.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (booking.services?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTime = (() => {
      if (timeFilter === 'all') return true
      if (timeFilter === 'today') {
        const today = new Date().toISOString().split('T')[0]
        const [year, month, day] = booking.booking_date.split('-').map(Number)
        const bookingDate = new Date(year, month - 1, day).toISOString().split('T')[0]
        return bookingDate === today
      }
      if (timeFilter === 'upcoming') return isUpcoming(booking.booking_date)
      if (timeFilter === 'past') return !isUpcoming(booking.booking_date)
      if (timeFilter === 'completed') return booking.status === 'completed'
      return true
    })()

    // Filter by payment status
    const matchesPayment = (() => {
      if (paymentFilter === 'all') return true
      return booking.payment_status === paymentFilter
    })()

    return matchesSearch && matchesTime && matchesPayment
  })




  const handleDeleteBooking = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Remove the booking from the local state
        setBookings(prev => prev.filter(booking => booking.id !== bookingId))
        setShowDeleteConfirm(false)
        setBookingToDelete(null)
        setSelectedBooking(null) // Close the modal if it's open
        toast.success('Booking deleted successfully')
      } else {
        // Handle error response
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to delete booking')
        setShowDeleteConfirm(false)
        setBookingToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting booking:', error)
      toast.error('Failed to delete booking')
      setShowDeleteConfirm(false)
      setBookingToDelete(null)
    }
  }

  const openBookingDetails = (booking: BookingWithDetails) => {
    setSelectedBooking(booking)
    setShowBookingDetails(true)
  }

  const openRescheduleModal = (booking: BookingWithDetails, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    setBookingToReschedule(booking)
    setShowRescheduleModal(true)
  }

  const handleRescheduleSuccess = (updatedBooking: BookingWithDetails) => {
    // Update the booking in local state
    setBookings(prev => 
      prev.map(booking => 
        booking.id === updatedBooking.id 
          ? { ...booking, booking_date: updatedBooking.booking_date, booking_time: updatedBooking.booking_time }
          : booking
      )
    )
    setShowRescheduleModal(false)
    setBookingToReschedule(null)
  }

  // Mark booking as complete
  const markBookingComplete = async (booking: BookingWithDetails) => {
    try {
      const response = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed'
        })
      })

      if (response.ok) {
        // Update the booking in local state
        setBookings(prev => 
          prev.map(b => 
            b.id === booking.id 
              ? { ...b, status: 'completed' as const }
              : b
          )
        )
        toast.success('Booking marked as complete')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to mark booking as complete')
      }
    } catch (error) {
      console.error('Error marking booking as complete:', error)
      toast.error('Failed to mark booking as complete')
    }
  }


  const getCustomerTypeColor = (customerType: string) => {
    switch (customerType) {
      case 'new': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'existing': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getCustomerTypeColorForCalendar = (customerType: string) => {
    switch (customerType) {
      case 'new': return 'bg-purple-100 text-purple-800 hover:bg-purple-200'
      case 'existing': return 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }
  }

  const getCustomerTypeDotColor = (customerType: string) => {
    switch (customerType) {
      case 'new': return 'bg-purple-400'
      case 'existing': return 'bg-indigo-400'
      default: return 'bg-gray-400'
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'refunded': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // const renderPhoneNumber = (phone: string, bookingId: string, className: string = "text-blue-500 hover:text-blue-700 underline cursor-pointer") => {
  //   const isActive = activePhoneMenu === bookingId
  //   
  //   return (
  //     <div className="relative inline-block">
  //       <button
  //         onClick={(e: React.MouseEvent) => {
  //           e.stopPropagation()
  //           e.preventDefault()
  //           console.log('Phone button clicked, current active:', activePhoneMenu, 'bookingId:', bookingId)
  //           setActivePhoneMenu(isActive ? null : bookingId)
  //         }}
  //         className={className}
  //       >
  //         {phone}
  //       </button>
  //       
  //       {isActive && (
  //         <div className="absolute bg-white border border-gray-200 rounded-md shadow-xl z-[9999] min-w-[120px] overflow-visible" 
  //              style={{
  //                top: 'auto',
  //                bottom: '100%',
  //                left: '0',
  //                marginBottom: '4px'
  //              }}>
  //           <button
  //             onClick={(e: React.MouseEvent) => {
  //               e.stopPropagation()
  //               window.location.href = `tel:${phone}`
  //               setActivePhoneMenu(null)
  //             }}
  //             className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
  //           >
  //             <Phone className="w-3 h-3" />
  //             Call
  //           </button>
  //           <button
  //             onClick={(e: React.MouseEvent) => {
  //               e.stopPropagation()
  //               window.location.href = `sms:${phone}`
  //               setActivePhoneMenu(null)
  //             }}
  //             className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
  //           >
  //             <MessageSquare className="w-3 h-3" />
  //             Text
  //           </button>
  //         </div>
  //       )}
  //     </div>
  //   )
  // }

  const formatPrice = (price: number) => {
    return price === 0 ? "Free" : `$${Math.round(price / 100)}`
  }

  const formatTime = (time: string) => {
    // Create a proper date-time object for time formatting
    const dateTime = new Date(`2025-01-01T${time}`)
    const timeOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    
    return `${dateTime.toLocaleTimeString('en-US', timeOptions)} PST`
  }

  const formatDateTime = (date: string, time: string) => {
    // Create the actual date-time and format it properly
    const dateTime = new Date(`${date}T${time}`)
    
    // Format date part
    const dateOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Los_Angeles',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }
    const datePart = dateTime.toLocaleDateString('en-US', dateOptions)
    
    // Format time part
    const timeOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    const timePart = dateTime.toLocaleTimeString('en-US', timeOptions)
    
    return (
      <div>
        <div className="text-sm text-gray-900">{datePart}</div>
        <div className="text-xs text-gray-500">{timePart}</div>
      </div>
    )
  }


  // Calendar helper functions
  const getBookingsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return filteredBookings.filter(booking => booking.booking_date === dateStr)
  }

  // const getAppointmentCountForDate = (date: Date) => {
  //   return getBookingsForDate(date).length
  // }

  const handleCalendarDateSelect = (date: Date | undefined) => {
    setSelectedCalendarDate(date)
  }


  // Navigate calendar forward/backward
  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(calendarStartDate)
    
    switch (calendarView) {
      case '3day':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 3 : -3))
        break
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
        break
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
        break
    }
    
    setCalendarStartDate(newDate)
  }

  // Generate days for 3-day or weekly views
  const generateColumnDays = () => {
    const days = []
    const numDays = calendarView === '3day' ? 3 : 7
    
    for (let i = 0; i < numDays; i++) {
      const date = new Date(calendarStartDate)
      date.setDate(date.getDate() + i)
      days.push(date)
    }
    
    return days
  }

  const generateCalendarDays = () => {
    const today = new Date()
    const currentMonth = today.getMonth()
    const currentYear = today.getFullYear()
    
    // Get first day of current month
    const firstDay = new Date(currentYear, currentMonth, 1)
    const lastDay = new Date(currentYear, currentMonth + 1, 0)
    
    // Get starting day of week (0 = Sunday)
    const startDay = firstDay.getDay()
    
    // Get last day of previous month
    const prevMonth = new Date(currentYear, currentMonth, 0)
    const prevMonthDays = prevMonth.getDate()
    
    const days = []
    
    // Add days from previous month
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, prevMonthDays - i)
      days.push({
        date,
        isCurrentMonth: false
      })
    }
    
    // Add days from current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(currentYear, currentMonth, day)
      days.push({
        date,
        isCurrentMonth: true
      })
    }
    
    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length // 6 rows × 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentYear, currentMonth + 1, day)
      days.push({
        date,
        isCurrentMonth: false
      })
    }
    
    return days
  }

  // Get calendar header text based on view
  const getCalendarHeaderText = () => {
    if (calendarView === 'month') {
      return new Date().toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric'
      })
    } else {
      const endDate = new Date(calendarStartDate)
      const numDays = calendarView === '3day' ? 3 : 7
      endDate.setDate(endDate.getDate() + numDays - 1)
      
      return `${calendarStartDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })} - ${endDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      })}`
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bookings Management</h1>
        <p className="text-gray-600 text-sm sm:text-base">Manage all customer bookings and appointments</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{bookings.filter(b => b.status === 'confirmed').length}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 md:h-6 md:w-6 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-200">
                  <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-blue-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs md:text-sm text-gray-600">Confirmed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Link href="/admin/waitlist" className="block">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col items-center text-center">
                <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{waitlistCount}</div>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 md:h-6 md:w-6 bg-purple-50 rounded-lg flex items-center justify-center border border-purple-200">
                    <ListChecks className="h-3 w-3 md:h-4 md:w-4 text-purple-600" strokeWidth={1.5} />
                  </div>
                  <div className="text-xs md:text-sm text-gray-600 flex items-center gap-1">
                    Waitlist
                    <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {bookings.filter(b => {
                  const today = new Date().toISOString().split('T')[0]
                  // Parse booking date without timezone conversion to avoid day shift
                  const [year, month, day] = b.booking_date.split('-').map(Number)
                  const bookingDate = new Date(year, month - 1, day).toISOString().split('T')[0]
                  return bookingDate === today
                }).length}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 md:h-6 md:w-6 bg-orange-50 rounded-lg flex items-center justify-center border border-orange-200">
                  <CalendarDays className="h-3 w-3 md:h-4 md:w-4 text-orange-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs md:text-sm text-gray-600">Today</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Revenue Card */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                ${Math.round(bookings
                  .filter(b => b.payment_status === 'paid')
                  .reduce((sum, b) => sum + (b.price_charged || 0), 0) / 100
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 md:h-6 md:w-6 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-200">
                  <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-emerald-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs md:text-sm text-gray-600">Revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 mb-6 mt-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by customer name, email, or service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-full sm:w-36 md:w-40">
                <SelectValue placeholder="Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="past">Past</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-36 md:w-40">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start">
        {/* Table vs Calendar Toggle */}
        <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 p-1 rounded-lg">
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
          >
            <Table className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Table</span>
            <span className="sm:hidden">Table</span>
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
          >
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Calendar</span>
            <span className="sm:hidden">Calendar</span>
          </Button>
        </div>
        
        {/* Calendar View Options - Only show when calendar view is active */}
        {viewMode === 'calendar' && (
          <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 p-1 rounded-lg">
            <Button
              variant={calendarView === '3day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCalendarView('3day')}
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              3 Days
            </Button>
            <Button
              variant={calendarView === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCalendarView('week')}
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              Week
            </Button>
            <Button
              variant={calendarView === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCalendarView('month')}
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              Month
            </Button>
          </div>
        )}
      </div>

      {/* Bookings Display */}
      {viewMode === 'table' ? (
        <Card className="border border-gray-200 shadow-sm">
          <CardContent className="p-0">
            {filteredBookings.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">No bookings found</p>
              </div>
            ) : (
              <>
                {/* Mobile & Tablet Card Layout */}
                <div className="block xl:hidden">
                  {filteredBookings.map((booking) => (
                    <div 
                      key={booking.id}
                      onClick={() => openBookingDetails(booking)}
                      className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="mb-3">
                        <div className="flex justify-between items-start">
                          <div className="font-medium text-gray-900">{booking.customers.name}</div>
                          <Badge className={`${getCustomerTypeColor(booking.customer_type_at_booking)} text-xs px-2 py-1`}>
                            {booking.customer_type_at_booking}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Service:</span>
                          <div className="text-right">
                            <div className="text-gray-900">{booking.services?.name || 'Service not found'}</div>
                            <div className="text-xs text-gray-500">{booking.duration_minutes} min</div>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Date & Time:</span>
                          <div className="text-right">
                            {formatDateTime(booking.booking_date, booking.booking_time)}
                          </div>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Price:</span>
                          <div className="text-right">
                            <div className="text-gray-900">{formatPrice(booking.price_charged)}</div>
                            {booking.price_charged === 0 ? (
                              <span className="text-xs text-gray-500 mt-1">Free</span>
                            ) : booking.payment_status === 'pending' ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="h-6 px-2 text-xs mt-1"
                                    disabled={processingPayment.has(booking.id)}
                                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                  >
                                    {processingPayment.has(booking.id) ? (
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <CreditCard className="w-3 h-3 mr-1" />
                                    )}
                                    {processingPayment.has(booking.id) ? 'Processing...' : 'Pay Now'}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem 
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      createSquareOrderForPOS(booking)
                                    }}
                                  >
                                    <CreditCard className="w-4 h-4 mr-2" />
                                    Pay Now (POS)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      sendPaymentLinkEmail(booking)
                                    }}
                                  >
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Send Payment Link
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Badge className={`${getPaymentStatusColor(booking.payment_status)} text-xs px-2 py-1 mt-1`}>
                                {booking.payment_status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation()
                              window.open(`tel:${booking.customers.phone}`, '_self')
                            }}
                            title={`Call ${booking.customers.name}`}
                          >
                            <Phone className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation()
                              window.open(`sms:${booking.customers.phone}`, '_self')
                            }}
                            title={`Text ${booking.customers.name}`}
                          >
                            <MessageSquare className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation()
                              window.open(`mailto:${booking.customers.email}`, '_self')
                            }}
                            title={`Email ${booking.customers.name}`}
                          >
                            <Mail className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        {/* Kebab Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuContent align="end" className="z-[9999]" side="bottom" alignOffset={0} sideOffset={8}>
                            <DropdownMenuItem 
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                openRescheduleModal(booking, e)
                              }}
                              disabled={booking.status === 'completed'}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Reschedule
                            </DropdownMenuItem>
                            {booking.price_charged && booking.price_charged > 0 && booking.payment_status !== 'paid' && (
                              <>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    createSquareOrderForPOS(booking)
                                  }}
                                >
                                  <CreditCard className="w-4 h-4 mr-2" />
                                  Pay Now (POS)
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    sendPaymentLinkEmail(booking)
                                  }}
                                  disabled={processingPayment.has(booking.id)}
                                >
                                  {processingPayment.has(booking.id) ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                  )}
                                  {processingPayment.has(booking.id) ? 'Processing...' : 'Send Payment Link'}
                                </DropdownMenuItem>
                              </>
                            )}
                            {booking.status !== 'completed' && (
                              <DropdownMenuItem 
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation()
                                  markBookingComplete(booking)
                                }}
                              >
                                <CheckSquare className="w-4 h-4 mr-2" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                          </DropdownMenuPortal>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tablet Layout - REMOVED */}
                <div className="hidden overflow-x-auto overflow-y-visible">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredBookings.map((booking) => (
                        <tr 
                          key={booking.id}
                          onClick={() => openBookingDetails(booking)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{booking.customers.name}</div>
                              <Badge className={`${getCustomerTypeColor(booking.customer_type_at_booking)} text-xs px-2 py-1 mt-1`}>
                                {booking.customer_type_at_booking}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div>
                              <div className="text-sm text-gray-900">{booking.services?.name || 'Service not found'}</div>
                              <div className="text-xs text-gray-500">{booking.duration_minutes} min</div>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {formatDateTime(booking.booking_date, booking.booking_time)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              <div>{formatPrice(booking.price_charged)}</div>
                              <Badge className={`${getPaymentStatusColor(booking.payment_status)} text-xs px-2 py-1 mt-1`}>
                                {booking.payment_status}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm relative">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuPortal>
                            <DropdownMenuContent align="end" className="z-[9999]" side="bottom" alignOffset={0} sideOffset={8}>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    window.open(`tel:${booking.customers.phone}`, '_self')
                                  }}
                                >
                                  <Phone className="w-4 h-4 mr-2" />
                                  Call {booking.customers.name}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    window.open(`sms:${booking.customers.phone}`, '_self')
                                  }}
                                >
                                  <MessageSquare className="w-4 h-4 mr-2" />
                                  Text {booking.customers.name}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    window.open(`mailto:${booking.customers.email}`, '_self')
                                  }}
                                >
                                  <Mail className="w-4 h-4 mr-2" />
                                  Email {booking.customers.name}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    openRescheduleModal(booking, e)
                                  }}
                                  disabled={booking.status === 'completed'}
                                >
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  Reschedule
                                </DropdownMenuItem>
                                {booking.price_charged && booking.price_charged > 0 && (
                                  <DropdownMenuItem 
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      generatePaymentLink(booking)
                                    }}
                                    disabled={booking.payment_status === 'paid' || processingPayment.has(booking.id)}
                                  >
                                    {processingPayment.has(booking.id) ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <CreditCard className="w-4 h-4 mr-2" />
                                    )}
                                    {processingPayment.has(booking.id) ? 'Processing...' : 'Pay with Square'}
                                  </DropdownMenuItem>
                                )}
                                {booking.status !== 'completed' && (
                                  <DropdownMenuItem 
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      markBookingComplete(booking)
                                    }}
                                  >
                                    <CheckSquare className="w-4 h-4 mr-2" />
                                    Mark Complete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                          </DropdownMenuPortal>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden xl:block overflow-x-auto overflow-y-visible">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredBookings.map((booking) => (
                        <tr 
                          key={booking.id}
                          onClick={() => openBookingDetails(booking)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{booking.customers.name}</div>
                              <Badge className={`${getCustomerTypeColor(booking.customer_type_at_booking)} text-xs px-2 py-1 mt-1`}>
                                {booking.customer_type_at_booking}
                              </Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>
                              <div className="text-sm text-gray-900">{booking.services?.name || 'Service not found'}</div>
                              <div className="text-xs text-gray-500">{booking.duration_minutes} min</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatDateTime(booking.booking_date, booking.booking_time)}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            <div>
                              <div>{formatPrice(booking.price_charged)}</div>
                              {booking.price_charged === 0 ? (
                                <span className="text-xs text-gray-500 mt-1">Free</span>
                              ) : booking.payment_status === 'pending' ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="h-6 px-2 text-xs mt-1"
                                      disabled={processingPayment.has(booking.id)}
                                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                    >
                                      {processingPayment.has(booking.id) ? (
                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      ) : (
                                        <CreditCard className="w-3 h-3 mr-1" />
                                      )}
                                      {processingPayment.has(booking.id) ? 'Processing...' : 'Pay Now'}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem 
                                      onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation()
                                        createSquareOrderForPOS(booking)
                                      }}
                                    >
                                      <CreditCard className="w-4 h-4 mr-2" />
                                      Pay Now (POS)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation()
                                        sendPaymentLinkEmail(booking)
                                      }}
                                    >
                                      <MessageSquare className="w-4 h-4 mr-2" />
                                      Send Payment Link
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <Badge className={`${getPaymentStatusColor(booking.payment_status)} text-xs px-2 py-1 mt-1`}>
                                  {booking.payment_status}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm relative">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="w-3 h-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuPortal>
                            <DropdownMenuContent align="end" className="z-[9999]" side="bottom" alignOffset={0} sideOffset={8}>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    window.open(`tel:${booking.customers.phone}`, '_self')
                                  }}
                                >
                                  <Phone className="w-4 h-4 mr-2" />
                                  Call {booking.customers.name}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    window.open(`sms:${booking.customers.phone}`, '_self')
                                  }}
                                >
                                  <MessageSquare className="w-4 h-4 mr-2" />
                                  Text {booking.customers.name}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    window.open(`mailto:${booking.customers.email}`, '_self')
                                  }}
                                >
                                  <Mail className="w-4 h-4 mr-2" />
                                  Email {booking.customers.name}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation()
                                    openRescheduleModal(booking, e)
                                  }}
                                  disabled={booking.status === 'completed'}
                                >
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  Reschedule
                                </DropdownMenuItem>
                                {booking.price_charged && booking.price_charged > 0 && (
                                  <DropdownMenuItem 
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      generatePaymentLink(booking)
                                    }}
                                    disabled={booking.payment_status === 'paid' || processingPayment.has(booking.id)}
                                  >
                                    {processingPayment.has(booking.id) ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <CreditCard className="w-4 h-4 mr-2" />
                                    )}
                                    {processingPayment.has(booking.id) ? 'Processing...' : 'Pay with Square'}
                                  </DropdownMenuItem>
                                )}
                                {booking.status !== 'completed' && (
                                  <DropdownMenuItem 
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      markBookingComplete(booking)
                                    }}
                                  >
                                    <CheckSquare className="w-4 h-4 mr-2" />
                                    Mark Complete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                          </DropdownMenuPortal>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Full-Screen Calendar View */}
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-0">
              <div>
                {/* Calendar Header */}
                <div className="border-b border-gray-200 p-3 sm:p-4">
                  <div className="flex justify-between items-center mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateCalendar('prev')}
                      className="h-8"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                        {getCalendarHeaderText()}
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCalendarStartDate(new Date())}
                        className="h-8 text-xs"
                      >
                        Today
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateCalendar('next')}
                      className="h-8"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                      <span className="text-gray-600">New Customer</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-indigo-400 rounded-full"></div>
                      <span className="text-gray-600">Existing Customer</span>
                    </div>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="p-3 sm:p-4">
                  {calendarView === 'month' ? (
                    <>
                      {/* Days of Week Header */}
                      <div className="grid grid-cols-7 gap-px mb-2">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                          <div key={day} className="p-2 sm:p-3 md:p-4 text-center text-xs sm:text-sm font-medium text-gray-500 bg-gray-50">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* Monthly Calendar Days */}
                      <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                        {generateCalendarDays().map((day, index) => {
                          const appointments = getBookingsForDate(day.date)
                          const isToday = day.date.toDateString() === new Date().toDateString()
                          const isCurrentMonth = day.isCurrentMonth
                          
                          return (
                            <div
                              key={index}
                              className={`min-h-[80px] sm:min-h-[100px] md:min-h-[120px] bg-white p-1 sm:p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                                !isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''
                              } ${isToday ? 'bg-blue-50 border-l-2 sm:border-l-3 md:border-l-4 border-blue-500' : ''}`}
                              onClick={() => handleCalendarDateSelect(day.date)}
                            >
                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs sm:text-sm font-medium ${
                                  isToday ? 'text-blue-600' : 
                                  isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                                }`}>
                                  {day.date.getDate()}
                                </span>
                                {appointments.length > 0 && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-1 sm:px-2 py-0.5 sm:py-1 rounded-full">
                                    {appointments.length}
                                  </span>
                                )}
                              </div>
                              
                              {/* Appointment List - Show on tablet and up */}
                              <div className="space-y-0.5 sm:space-y-1 hidden sm:block">
                                {appointments.slice(0, 2).map((booking) => (
                                  <div
                                    key={booking.id}
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      openBookingDetails(booking)
                                    }}
                                    className={`text-xs p-1 rounded truncate cursor-pointer ${getCustomerTypeColorForCalendar(booking.customer_type_at_booking)}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>
                                        {formatTime(booking.booking_time)} - {booking.customers.name}
                                      </span>
                                      {booking.payment_status !== 'paid' && booking.price_charged && booking.price_charged > 0 && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="h-4 w-4 p-0 hover:bg-white/20"
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation()
                                            generatePaymentLink(booking)
                                          }}
                                          disabled={processingPayment.has(booking.id)}
                                          title="Generate payment link"
                                        >
                                          {processingPayment.has(booking.id) ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <CreditCard className="w-3 h-3" />
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {appointments.length > 2 && (
                                  <div className="text-xs text-gray-500 p-1">
                                    +{appointments.length - 2} more
                                  </div>
                                )}
                              </div>
                              
                              {/* Mobile: Show only dots for appointments */}
                              <div className="sm:hidden">
                                {appointments.length > 0 && (
                                  <div className="flex flex-wrap gap-0.5 mt-1">
                                    {appointments.slice(0, 4).map((booking, i) => (
                                      <div 
                                        key={i} 
                                        className={`w-1.5 h-1.5 rounded-full ${getCustomerTypeDotColor(booking.customer_type_at_booking)}`}
                                      ></div>
                                    ))}
                                    {appointments.length > 4 && (
                                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Column-based views (3-day, week) */}
                      <div className="overflow-x-auto">
                        <div className={`grid gap-2 ${
                          calendarView === '3day' ? 'grid-cols-3' : 'grid-cols-7'
                        } min-w-max`}>
                          {generateColumnDays().map((day, index) => {
                            const appointments = getBookingsForDate(day)
                            const isToday = day.toDateString() === new Date().toDateString()
                            const dayName = day.toLocaleDateString('en-US', { weekday: 'short' })
                            const dateNum = day.getDate()
                            
                            return (
                              <div
                                key={index}
                                className={`border border-gray-200 rounded-lg p-2 min-w-[150px] ${
                                  isToday ? 'bg-blue-50 border-blue-500 border-2' : 'bg-white'
                                }`}
                              >
                                {/* Day header */}
                                <div className="text-center mb-2 pb-2 border-b border-gray-200">
                                  <div className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                                    {dayName}
                                  </div>
                                  <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                                    {dateNum}
                                  </div>
                                </div>
                                
                                {/* Appointments list */}
                                <div className="space-y-1 min-h-[200px]">
                                  {appointments.length === 0 ? (
                                    <div className="text-center py-4">
                                      <p className="text-xs text-gray-400">No appointments</p>
                                    </div>
                                  ) : (
                                    appointments
                                      .sort((a, b) => a.booking_time.localeCompare(b.booking_time))
                                      .map((booking) => (
                                        <div
                                          key={booking.id}
                                          onClick={() => openBookingDetails(booking)}
                                          className={`text-xs p-2 rounded cursor-pointer ${getCustomerTypeColorForCalendar(booking.customer_type_at_booking)}`}
                                        >
                                          <div className="font-medium mb-1">
                                            {formatTime(booking.booking_time)}
                                          </div>
                                          <div className="truncate">{booking.customers.name}</div>
                                          <div className="text-xs opacity-75 truncate">
                                            {booking.services?.name}
                                          </div>
                                          {booking.payment_status !== 'paid' && booking.price_charged && booking.price_charged > 0 && (
                                            <Button 
                                              variant="ghost" 
                                              size="sm"
                                              className="h-5 w-full mt-1 hover:bg-white/20 text-xs"
                                              onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation()
                                                generatePaymentLink(booking)
                                              }}
                                              disabled={processingPayment.has(booking.id)}
                                              title="Generate payment link"
                                            >
                                              {processingPayment.has(booking.id) ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                              ) : (
                                                <>
                                                  <CreditCard className="w-3 h-3 mr-1" />
                                                  Pay
                                                </>
                                              )}
                                            </Button>
                                          )}
                                        </div>
                                      ))
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Details Panel */}
          {selectedCalendarDate && (
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">
                    {selectedCalendarDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCalendarDate(undefined)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {getBookingsForDate(selectedCalendarDate).length === 0 ? (
                    <div className="text-center py-4">
                      <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No appointments scheduled</p>
                      <p className="text-gray-400 text-xs">Click on a date with appointments to see details</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-700">
                          {getBookingsForDate(selectedCalendarDate).length} appointment{getBookingsForDate(selectedCalendarDate).length !== 1 ? 's' : ''} scheduled
                        </span>
                      </div>
                      
                      {/* Mobile Card Layout */}
                      <div className="block md:hidden">
                        {getBookingsForDate(selectedCalendarDate)
                          .sort((a, b) => a.booking_time.localeCompare(b.booking_time))
                          .map((booking) => (
                            <div 
                              key={booking.id}
                              onClick={() => openBookingDetails(booking)}
                              className="p-4 border border-gray-200 rounded-lg mb-2 hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <div className="mb-3">
                                <div className="flex justify-between items-start">
                                  <div className="font-medium text-gray-900">{booking.customers.name}</div>
                                  <Badge className={`${getCustomerTypeColor(booking.customer_type_at_booking)} text-xs px-2 py-1`}>
                                    {booking.customer_type_at_booking}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="space-y-2 mb-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Service:</span>
                                  <div className="text-right">
                                    <div className="text-gray-900">{booking.services?.name || 'Service not found'}</div>
                                    <div className="text-xs text-gray-500">{booking.duration_minutes} min</div>
                                  </div>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Time:</span>
                                  <div className="text-right text-gray-900">{formatTime(booking.booking_time)}</div>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Price:</span>
                                  <div className="text-right">
                                    <div className="text-gray-900">{formatPrice(booking.price_charged)}</div>
                                    {booking.price_charged === 0 ? (
                                      <span className="text-xs text-gray-500 mt-1">Free</span>
                                    ) : booking.payment_status === 'pending' ? (
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="h-6 px-2 text-xs mt-1"
                                        onClick={(e: React.MouseEvent) => {
                                          e.stopPropagation()
                                          generatePaymentLink(booking)
                                        }}
                                        disabled={processingPayment.has(booking.id)}
                                        title="Generate payment link"
                                      >
                                        {processingPayment.has(booking.id) ? (
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                        ) : (
                                          <CreditCard className="w-3 h-3 mr-1" />
                                        )}
                                        {processingPayment.has(booking.id) ? 'Processing...' : 'Pay Now'}
                                      </Button>
                                    ) : (
                                      <Badge className={`${getPaymentStatusColor(booking.payment_status)} text-xs px-2 py-1 mt-1`}>
                                        {booking.payment_status}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex justify-between items-center">
                                <div className="flex gap-1">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="h-8 px-2 text-xs"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      window.open(`tel:${booking.customers.phone}`, '_self')
                                    }}
                                    title={`Call ${booking.customers.name}`}
                                  >
                                    <Phone className="w-3 h-3" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="h-8 px-2 text-xs"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      window.open(`sms:${booking.customers.phone}`, '_self')
                                    }}
                                    title={`Text ${booking.customers.name}`}
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="h-8 px-2 text-xs"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation()
                                      window.open(`mailto:${booking.customers.email}`, '_self')
                                    }}
                                    title={`Email ${booking.customers.name}`}
                                  >
                                    <Mail className="w-3 h-3" />
                                  </Button>
                                </div>
                                
                                {/* Kebab Menu */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <MoreVertical className="w-3 h-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuPortal>
                                    <DropdownMenuContent align="end" className="z-[9999]" side="bottom" alignOffset={0} sideOffset={8}>
                                    <DropdownMenuItem 
                                      onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation()
                                        openRescheduleModal(booking, e)
                                      }}
                                      disabled={booking.status === 'completed'}
                                    >
                                      <RotateCcw className="w-4 h-4 mr-2" />
                                      Reschedule
                                    </DropdownMenuItem>
                                    {booking.price_charged && booking.price_charged > 0 && (
                                      <DropdownMenuItem 
                                        onClick={(e: React.MouseEvent) => {
                                          e.stopPropagation()
                                          generatePaymentLink(booking)
                                        }}
                                        disabled={booking.payment_status === 'paid' || processingPayment.has(booking.id)}
                                      >
                                        {processingPayment.has(booking.id) ? (
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                          <CreditCard className="w-4 h-4 mr-2" />
                                        )}
                                        {processingPayment.has(booking.id) ? 'Processing...' : 'Pay with Square'}
                                      </DropdownMenuItem>
                                    )}
                                    {booking.status !== 'completed' && (
                                      <DropdownMenuItem 
                                        onClick={(e: React.MouseEvent) => {
                                          e.stopPropagation()
                                          markBookingComplete(booking)
                                        }}
                                      >
                                        <CheckSquare className="w-4 h-4 mr-2" />
                                        Mark Complete
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                  </DropdownMenuPortal>
                                </DropdownMenu>
                              </div>
                            </div>
                          ))}
                      </div>

                      {/* Desktop Table Layout */}
                      <div className="hidden md:block overflow-x-auto overflow-y-visible">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {getBookingsForDate(selectedCalendarDate)
                              .sort((a, b) => a.booking_time.localeCompare(b.booking_time))
                              .map((booking) => (
                              <tr 
                                key={booking.id}
                                onClick={() => openBookingDetails(booking)}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                              >
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{booking.customers.name}</div>
                                    <Badge className={`${getCustomerTypeColor(booking.customer_type_at_booking)} text-xs px-2 py-1 mt-1`}>
                                      {booking.customer_type_at_booking}
                                    </Badge>
                                  </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div>
                                    <div className="text-sm text-gray-900">{booking.services?.name || 'Service not found'}</div>
                                    <div className="text-xs text-gray-500">{booking.duration_minutes} min</div>
                                  </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {formatDateTime(booking.booking_date, booking.booking_time)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span>{formatPrice(booking.price_charged)}</span>
                                      {booking.price_charged > 0 && booking.payment_status === 'pending' && (
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          className="h-6 px-2 text-xs"
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation()
                                            generatePaymentLink(booking)
                                          }}
                                          disabled={processingPayment.has(booking.id)}
                                          title="Generate payment link"
                                        >
                                          {processingPayment.has(booking.id) ? (
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          ) : (
                                            <CreditCard className="w-3 h-3 mr-1" />
                                          )}
                                          {processingPayment.has(booking.id) ? 'Processing...' : 'Pay Now'}
                                        </Button>
                                      )}
                                    </div>
                                    {booking.price_charged > 0 && booking.payment_status !== 'pending' && (
                                      <Badge className={`${getPaymentStatusColor(booking.payment_status)} text-xs px-2 py-1 mt-1`}>
                                        {booking.payment_status}
                                      </Badge>
                                    )}
                                    {booking.price_charged === 0 && (
                                      <span className="text-xs text-gray-500 mt-1">Free</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm relative">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <MoreVertical className="w-3 h-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuPortal>
                                      <DropdownMenuContent align="end" className="z-[9999]" side="bottom" alignOffset={0} sideOffset={8}>
                                        <DropdownMenuItem 
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation()
                                            window.open(`tel:${booking.customers.phone}`, '_self')
                                          }}
                                        >
                                          <Phone className="w-4 h-4 mr-2" />
                                          Call {booking.customers.name}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation()
                                            window.open(`sms:${booking.customers.phone}`, '_self')
                                          }}
                                        >
                                          <MessageSquare className="w-4 h-4 mr-2" />
                                          Text {booking.customers.name}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation()
                                            window.open(`mailto:${booking.customers.email}`, '_self')
                                          }}
                                        >
                                          <Mail className="w-4 h-4 mr-2" />
                                          Email {booking.customers.name}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation()
                                            openRescheduleModal(booking, e)
                                          }}
                                          disabled={booking.status === 'completed'}
                                        >
                                          <RotateCcw className="w-4 h-4 mr-2" />
                                          Reschedule
                                        </DropdownMenuItem>
                                        {booking.price_charged && booking.price_charged > 0 && (
                                          <DropdownMenuItem 
                                            onClick={(e: React.MouseEvent) => {
                                              e.stopPropagation()
                                              generatePaymentLink(booking)
                                            }}
                                            disabled={booking.payment_status === 'paid' || processingPayment.has(booking.id)}
                                          >
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            Pay with Square
                                          </DropdownMenuItem>
                                        )}
                                        {booking.status !== 'completed' && (
                                          <DropdownMenuItem 
                                            onClick={(e: React.MouseEvent) => {
                                              e.stopPropagation()
                                              markBookingComplete(booking)
                                            }}
                                          >
                                            <CheckSquare className="w-4 h-4 mr-2" />
                                            Mark Complete
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenuPortal>
                                  </DropdownMenu>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Booking Details Modal - Proper Slide-up Implementation */}
      {showBookingDetails && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 md:bg-black/20"
            onClick={() => setShowBookingDetails(false)}
          />
          
          {/* Modal Content */}
          <div className="fixed bottom-0 left-0 right-0 md:bottom-0 md:left-auto md:right-0 md:top-0 md:w-[500px] md:h-full bg-white rounded-t-3xl md:rounded-none md:rounded-l-xl shadow-xl md:shadow-2xl">
            {/* Mobile Slide-up Container */}
            <div className="h-full flex flex-col md:flex md:flex-col md:h-full">
              {/* Drag Handle for Mobile */}
              <div className="flex justify-center pt-3 pb-2 md:hidden">
                <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
              </div>
              
              {/* Header */}
              <div className="px-6 pb-4 border-b border-gray-200 md:border-none md:px-6 md:pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">
                        {selectedBooking?.services?.name || 'Service'}
                      </h2>
                      <div className="text-sm font-normal text-gray-600">
                        ({selectedBooking?.duration_minutes} min)
                      </div>
                    </div>
                  </div>
                  {selectedBooking && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          e.preventDefault()
                          window.location.href = `tel:${selectedBooking.customers.phone}`
                        }}
                        className="h-10 w-10 p-0"
                        title={`Call ${selectedBooking.customers.name}`}
                      >
                        <Phone className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          e.preventDefault()
                          window.location.href = `sms:${selectedBooking.customers.phone}`
                        }}
                        className="h-10 w-10 p-0"
                        title={`Text ${selectedBooking.customers.name}`}
                      >
                        <MessageSquare className="w-5 h-5" />
                      </Button>
                      <a
                        href={`mailto:${selectedBooking.customers.email}`}
                        className="inline-flex items-center justify-center h-10 w-10 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                        title={`Email ${selectedBooking.customers.name}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Mail className="w-5 h-5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
          
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 md:px-6 md:py-4 md:max-h-[calc(100vh-200px)]">
              {selectedBooking && (
                <div className="space-y-4 md:space-y-6 pb-4 md:pb-6">
                  {/* Customer Info */}
                  <div className="pb-6 md:pb-8 pt-4 md:border-t md:border-b md:border-gray-300">
                    <h4 className="font-semibold text-gray-900 mb-3 md:mb-4 text-lg">Customer Information</h4>
                    <div className="space-y-3 md:space-y-4">
                      <div className="flex justify-between items-center py-2 md:py-2">
                        <span className="text-gray-600">Customer</span>
                        <div className="flex items-center gap-2">
                          <Link 
                            href={`/admin/customers?customerId=${selectedBooking.customer_id}&search=${encodeURIComponent(selectedBooking.customers.name)}`}
                            className="font-medium text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          >
                            {selectedBooking.customers.name}
                          </Link>
                          <Badge
                            variant={selectedBooking.customer_type_at_booking === 'existing' ? "default" : "secondary"}
                            className={`${selectedBooking.customer_type_at_booking === 'existing' ? "bg-indigo-100 text-indigo-800" : "bg-purple-100 text-purple-800"}`}
                          >
                            {selectedBooking.customer_type_at_booking}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Booking Info */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 md:mb-4 text-lg">Booking Information</h4>
                    <div className="space-y-3 md:space-y-4">
                      <div className="flex justify-between items-start py-2 md:py-2">
                        <span className="text-gray-600">Date & Time</span>
                        <div className="text-right">
                          {formatDateTime(selectedBooking.booking_date, selectedBooking.booking_time)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-2 md:py-2">
                        <span className="text-gray-600">Status</span>
                        <Badge 
                          variant={selectedBooking.status === 'confirmed' ? 'default' : selectedBooking.status === 'completed' ? 'secondary' : 'destructive'}
                          className={
                            selectedBooking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                            selectedBooking.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }
                        >
                          {selectedBooking.status}
                        </Badge>
                      </div>
                        <div className="flex justify-between items-start py-2 md:py-2">
                        <span className="text-gray-600">Payment</span>
                        <div className="text-right">
                          <div className="font-medium text-gray-900 mb-1">{formatPrice(selectedBooking.price_charged)}</div>
                          <div className="flex items-center gap-2 justify-end">
                            {selectedBooking.price_charged === 0 ? (
                              <span className="text-xs text-gray-500">Free appointment</span>
                            ) : (
                              <>
                                <Badge 
                                  variant={selectedBooking.payment_status === 'paid' ? 'default' : 'secondary'}
                                  className={selectedBooking.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                                >
                                  {selectedBooking.payment_status}
                                </Badge>
                                {selectedBooking.payment_status !== 'paid' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => generatePaymentLink(selectedBooking)}
                                    title="Generate and copy payment link"
                                  >
                                    <CreditCard className="w-3 h-3 mr-1" />
                                    Pay Now
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-2 md:py-2">
                        <span className="text-gray-600">Created</span>
                        <span className="font-medium text-gray-900">{new Date(selectedBooking.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white md:px-6 md:py-6 md:border-none">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowBookingDetails(false)}
                  className="flex-1 h-12"
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-12 bg-red-600 hover:bg-red-700 border border-black"
                  disabled={selectedBooking?.payment_status === 'paid'}
                  onClick={() => {
                    if (selectedBooking?.id) {
                      setBookingToDelete(selectedBooking.id)
                      setShowDeleteConfirm(true)
                      setShowBookingDetails(false)
                    }
                  }}
                >
                  🗑️ Delete Booking
                </Button>
              </div>
              {selectedBooking?.payment_status === 'paid' && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Cannot delete paid bookings to maintain financial integrity
                </p>
              )}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      <RescheduleModal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false)
          setBookingToReschedule(null)
        }}
        booking={bookingToReschedule}
        onRescheduleSuccess={handleRescheduleSuccess}
        apiEndpoint="/api/admin/bookings"
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this booking? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 justify-center pt-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setShowDeleteConfirm(false)
                setBookingToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (bookingToDelete) {
                  handleDeleteBooking(bookingToDelete)
                }
              }}
            >
              🗑️ DELETE
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
