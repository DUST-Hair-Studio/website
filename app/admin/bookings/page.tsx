'use client'

import { useState, useEffect } from 'react'
import { Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { formatBusinessDateTime } from '@/lib/timezone-utils-client'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { CheckCircle, Calendar, DollarSign, CalendarDays, RotateCcw, Search, Filter, Table, Grid3X3, Phone, MessageSquare, Mail } from 'lucide-react'
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
  const [timeFilter, setTimeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null)
  const [showBookingDetails, setShowBookingDetails] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [bookingToReschedule, setBookingToReschedule] = useState<BookingWithDetails | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(undefined)
  const [showCalendarAppointments, setShowCalendarAppointments] = useState(false)
  const [activePhoneMenu, setActivePhoneMenu] = useState<string | null>(null)

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
      return true
    })()

    // Filter by status
    const matchesStatus = (() => {
      if (statusFilter === 'active') {
        // Show only non-cancelled appointments by default
        return booking.status !== 'cancelled'
      }
      if (statusFilter === 'all') {
        // Show all appointments including cancelled
        return true
      }
      // Show specific status
      return booking.status === statusFilter
    })()

    return matchesSearch && matchesTime && matchesStatus
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
      }
    } catch (error) {
      console.error('Error deleting booking:', error)
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'no-show': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
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

  const renderPhoneNumber = (phone: string, bookingId: string, className: string = "text-blue-500 hover:text-blue-700 underline cursor-pointer") => {
    const isActive = activePhoneMenu === bookingId
    
    return (
      <div className="relative inline-block">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setActivePhoneMenu(isActive ? null : bookingId)
          }}
          className={className}
        >
          {phone}
        </button>
        
        {isActive && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[120px]">
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.open(`tel:${phone}`, '_self')
                setActivePhoneMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <Phone className="w-3 h-3" />
              Call
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.open(`sms:${phone}`, '_self')
                setActivePhoneMenu(null)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <MessageSquare className="w-3 h-3" />
              Text
            </button>
          </div>
        )}
      </div>
    )
  }

  const formatPrice = (price: number) => {
    return price === 0 ? "Free" : `$${(price / 100).toFixed(2)}`
  }

  const formatTime = (time: string) => {
    // Use timezone utilities for consistent time formatting
    const formattedTime = formatBusinessDateTime('2025-01-01', time, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }, 'America/Los_Angeles')
    
    return `${formattedTime} PST`
  }

  const formatDateTime = (date: string, time: string) => {
    // Use timezone utilities for consistent formatting
    const formattedDate = formatBusinessDateTime(date, '00:00:00', {
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    }, 'America/Los_Angeles')
    
    const formattedTime = formatBusinessDateTime('2025-01-01', time, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }, 'America/Los_Angeles').split(' ').slice(-2).join(' ')
    
    return `${formattedDate} at ${formattedTime}`
  }

  const formatDate = (date: string) => {
    // Use timezone utilities for consistent formatting
    return formatBusinessDateTime(date, '00:00:00', {
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    }, 'America/Los_Angeles')
  }

  // Calendar helper functions
  const getBookingsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return filteredBookings.filter(booking => booking.booking_date === dateStr)
  }

  const getAppointmentCountForDate = (date: Date) => {
    return getBookingsForDate(date).length
  }

  const handleCalendarDateSelect = (date: Date | undefined) => {
    setSelectedCalendarDate(date)
    if (date) {
      const appointments = getBookingsForDate(date)
      if (appointments.length > 0) {
        setShowCalendarAppointments(true)
      }
    }
  }

  const getCalendarDayModifiers = (date: Date) => {
    const appointmentCount = getAppointmentCountForDate(date)
    return {
      hasAppointments: appointmentCount > 0,
      hasManyAppointments: appointmentCount >= 3,
      isToday: date.toDateString() === new Date().toDateString()
    }
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
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900">{bookings.filter(b => b.status === 'confirmed').length}</div>
                <div className="text-xs md:text-sm text-gray-600 mt-1">Confirmed</div>
              </div>
              <div className="h-6 w-6 md:h-8 md:w-8 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-200">
                <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-blue-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900">{bookings.filter(b => b.status === 'completed').length}</div>
                <div className="text-xs md:text-sm text-gray-600 mt-1">Completed</div>
              </div>
              <div className="h-6 w-6 md:h-8 md:w-8 bg-green-50 rounded-lg flex items-center justify-center border border-green-200">
                <Calendar className="h-3 w-3 md:h-4 md:w-4 text-green-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  {bookings.filter(b => {
                    const today = new Date().toISOString().split('T')[0]
                    // Parse booking date without timezone conversion to avoid day shift
                    const [year, month, day] = b.booking_date.split('-').map(Number)
                    const bookingDate = new Date(year, month - 1, day).toISOString().split('T')[0]
                    return bookingDate === today
                  }).length}
                </div>
                <div className="text-xs md:text-sm text-gray-600 mt-1">Today</div>
              </div>
              <div className="h-6 w-6 md:h-8 md:w-8 bg-orange-50 rounded-lg flex items-center justify-center border border-orange-200">
                <CalendarDays className="h-3 w-3 md:h-4 md:w-4 text-orange-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Revenue Card */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900">$0.00</div>
                <div className="text-xs md:text-sm text-gray-600 mt-1">Revenue</div>
              </div>
              <div className="h-6 w-6 md:h-8 md:w-8 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-200">
                <DollarSign className="h-3 w-3 md:h-4 md:w-4 text-emerald-600" strokeWidth={1.5} />
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
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="past">Past</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36 md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no-show">No Show</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex justify-center sm:justify-start">
        <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 p-1 rounded-lg">
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
          >
            <Table className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Table View</span>
            <span className="sm:hidden">Table</span>
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
          >
            <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Calendar View</span>
            <span className="sm:hidden">Calendar</span>
          </Button>
        </div>
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
                {/* Mobile Card Layout */}
                <div className="block lg:hidden">
                  {filteredBookings.map((booking) => (
                    <div 
                      key={booking.id}
                      onClick={() => openBookingDetails(booking)}
                      className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-medium text-gray-900">{booking.customers.name}</div>
                          {renderPhoneNumber(booking.customers.phone, booking.id, "text-blue-500 hover:text-blue-700 underline cursor-pointer text-sm")}
                        </div>
                        <Badge className={`${getCustomerTypeColor(booking.customer_type_at_booking)} text-xs px-2 py-1`}>
                          {booking.customer_type_at_booking}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Service:</span>
                          <span className="text-gray-900">{booking.services?.name || 'Service not found'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Date:</span>
                          <span className="text-gray-900">{formatDate(booking.booking_date)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Time:</span>
                          <span className="text-gray-900">{formatTime(booking.booking_time)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Duration:</span>
                          <span className="text-gray-900">{booking.duration_minutes} min</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Price:</span>
                          <span className="text-gray-900">{formatPrice(booking.price_charged)}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={(e) => {
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
                          onClick={(e) => {
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
                          className="h-8 px-3 text-xs flex-1"
                          onClick={(e) => openRescheduleModal(booking, e)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reschedule
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tablet Layout */}
                <div className="hidden lg:block md:block xl:hidden overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
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
                              {renderPhoneNumber(booking.customers.phone, booking.id, "text-blue-500 hover:text-blue-700 underline cursor-pointer text-xs")}
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{booking.services?.name || 'Service not found'}</div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div>
                              <div className="text-sm text-gray-900">{formatDateTime(booking.booking_date, booking.booking_time)}</div>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatPrice(booking.price_charged)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm">
                            <div className="flex gap-1">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={(e) => openRescheduleModal(booking, e)}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Reschedule
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden xl:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
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
                              {renderPhoneNumber(booking.customers.phone, booking.id, "text-blue-500 hover:text-blue-700 underline cursor-pointer text-sm")}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{booking.services?.name || 'Service not found'}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>
                              <div className="text-sm text-gray-900">{formatDateTime(booking.booking_date, booking.booking_time)}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {booking.duration_minutes} min
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {formatPrice(booking.price_charged)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge className={`${getCustomerTypeColor(booking.customer_type_at_booking)} text-xs px-2 py-1`}>
                              {booking.customer_type_at_booking}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={(e) => openRescheduleModal(booking, e)}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Reschedule
                              </Button>
                            </div>
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
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                      {new Date().toLocaleDateString('en-US', { 
                        month: 'long', 
                        year: 'numeric'
                      })}
                    </h2>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 mt-3 text-xs sm:text-sm">
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
                  {/* Days of Week Header */}
                  <div className="grid grid-cols-7 gap-px mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="p-2 sm:p-3 md:p-4 text-center text-xs sm:text-sm font-medium text-gray-500 bg-gray-50">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days */}
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
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openBookingDetails(booking)
                                }}
                                className={`text-xs p-1 rounded truncate cursor-pointer ${getCustomerTypeColorForCalendar(booking.customer_type_at_booking)}`}
                              >
                                {formatTime(booking.booking_time)} - {booking.customers.name}
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
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
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
                                    {renderPhoneNumber(booking.customers.phone, booking.id, "text-blue-500 hover:text-blue-700 underline cursor-pointer text-sm")}
                                  </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{booking.services?.name || 'Service not found'}</div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{formatTime(booking.booking_time)}</div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                  {booking.duration_minutes} min
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                  {formatPrice(booking.price_charged)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <Badge className={`${getCustomerTypeColor(booking.customer_type_at_booking)} text-xs px-2 py-1`}>
                                    {booking.customer_type_at_booking}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                  <div className="flex gap-1">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={(e) => {
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
                                      className="h-7 px-2 text-xs"
                                      onClick={(e) => {
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
                                      className="h-7 px-2 text-xs"
                                      onClick={(e) => openRescheduleModal(booking, e)}
                                    >
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                      Reschedule
                                    </Button>
                                  </div>
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

      {/* Booking Details Modal */}
      <Dialog open={showBookingDetails} onOpenChange={setShowBookingDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <div>
                <DialogTitle>Booking Details</DialogTitle>
                <DialogDescription>
                  {selectedBooking?.customers.name} - {selectedBooking?.services?.name || 'Service not found'}
                </DialogDescription>
              </div>
              {selectedBooking && (
                <div className="flex gap-2 mr-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`tel:${selectedBooking.customers.phone}`, '_self')}
                    className="h-8 w-8 p-0"
                    title={`Call ${selectedBooking.customers.name}`}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`sms:${selectedBooking.customers.phone}`, '_self')}
                    className="h-8 w-8 p-0"
                    title={`Text ${selectedBooking.customers.name}`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`mailto:${selectedBooking.customers.email}`, '_self')}
                    className="h-8 w-8 p-0"
                    title={`Email ${selectedBooking.customers.name}`}
                  >
                    <Mail className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div>
                <h4 className="font-medium mb-2">Customer Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Name:</strong> {selectedBooking.customers.name}</p>
                    <p><strong>Email:</strong> 
                      <a 
                        href={`mailto:${selectedBooking.customers.email}`}
                        className="text-blue-500 hover:text-blue-700 underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {selectedBooking.customers.email}
                      </a>
                    </p>
                    <div className="flex items-center gap-2">
                      <p><strong>Phone:</strong></p>
                      {renderPhoneNumber(selectedBooking.customers.phone, selectedBooking.id, "text-blue-500 hover:text-blue-700 underline cursor-pointer")}
                    </div>
                  </div>
                  <div>
                    <p><strong>Type:</strong> {selectedBooking.customer_type_at_booking}</p>
                    <p><strong>Price Charged:</strong> {formatPrice(selectedBooking.price_charged)}</p>
                    <p><strong>Payment Status:</strong> {selectedBooking.payment_status}</p>
                  </div>
                </div>
              </div>

              {/* Booking Info */}
              <div>
                <h4 className="font-medium mb-2">Booking Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Service:</strong> {selectedBooking.services?.name || 'Service not found'}</p>
                    <p><strong>Duration:</strong> {selectedBooking.duration_minutes} minutes</p>
                    <p><strong>Date:</strong> {formatDate(selectedBooking.booking_date)}</p>
                  </div>
                  <div>
                    <p><strong>Time:</strong> {formatTime(selectedBooking.booking_time)}</p>
                    <p><strong>Status:</strong> {selectedBooking.status}</p>
                    <p><strong>Created:</strong> {new Date(selectedBooking.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-xs sm:text-sm sm:size-lg"
                  onClick={() => {
                    setBookingToDelete(selectedBooking.id)
                    setShowDeleteConfirm(true)
                    setShowBookingDetails(false)
                  }}
                >
                  🗑️ DELETE BOOKING
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
