'use client'

import { useState, useEffect } from 'react'
import { Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { CheckCircle, Calendar, DollarSign, CalendarDays } from 'lucide-react'

interface BookingWithDetails extends Booking {
  services: {
    name: string;
    description: string;
    duration_minutes: number;
    new_customer_price: number;
    existing_customer_price: number;
  } | null;
  customers: {
    name: string;
    email: string;
    phone: string;
    is_existing_customer: boolean;
  };
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null)

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

  // Filter bookings
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.customers.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customers.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (booking.services?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        setBookings(prev => 
          prev.map(booking => 
            booking.id === bookingId 
              ? { ...booking, status: newStatus as 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no-show' }
              : booking
          )
        )
      }
    } catch (error) {
      console.error('Error updating booking status:', error)
    }
  }



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

  const formatPrice = (price: number) => {
    return price === 0 ? "Free" : `$${(price / 100).toFixed(2)}`
  }

  const formatTime = (time: string) => {
    const timeOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
    
    // Convert time string to PST format
    const [hours, minutes] = time.split(':')
    const timeInPST = new Date()
    timeInPST.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    const formattedTime = timeInPST.toLocaleTimeString('en-US', timeOptions)
    
    return `${formattedTime} PST`
  }

  const formatDateTime = (date: string, time: string) => {
    // Treat the date string as local time, not UTC
    const bookingDate = new Date(date + 'T00:00:00')
    const formattedDate = bookingDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      timeZone: 'America/Los_Angeles'
    })
    
    return `${formattedDate} at ${formatTime(time)}`
  }

  const formatDate = (date: string) => {
    // Treat the date string as local time, not UTC
    const bookingDate = new Date(date + 'T00:00:00')
    return bookingDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/Los_Angeles'
    })
  }

  const isUpcoming = (date: string) => {
    // Treat the date string as local time, not UTC
    const bookingDate = new Date(date + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return bookingDate >= today
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
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings Management</h1>
          <p className="text-gray-600">Manage all customer bookings and appointments</p>
        </div>
        <div className="text-sm text-gray-500">
          Total: {bookings.length} bookings
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">{bookings.filter(b => b.status === 'confirmed').length}</div>
                <div className="text-sm text-gray-600 mt-1">Confirmed</div>
              </div>
              <div className="h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-200">
                <CheckCircle className="h-4 w-4 text-blue-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">{bookings.filter(b => b.status === 'completed').length}</div>
                <div className="text-sm text-gray-600 mt-1">Completed</div>
              </div>
              <div className="h-8 w-8 bg-green-50 rounded-lg flex items-center justify-center border border-green-200">
                <Calendar className="h-4 w-4 text-green-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {bookings.filter(b => {
                    const today = new Date().toISOString().split('T')[0]
                    const bookingDate = new Date(b.booking_date).toISOString().split('T')[0]
                    return bookingDate === today
                  }).length}
                </div>
                <div className="text-sm text-gray-600 mt-1">Today</div>
              </div>
              <div className="h-8 w-8 bg-orange-50 rounded-lg flex items-center justify-center border border-orange-200">
                <CalendarDays className="h-4 w-4 text-orange-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="Search by customer name, email, or service..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no-show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">No bookings found</p>
            </CardContent>
          </Card>
        ) : (
          filteredBookings.map((booking) => (
          <Card key={booking.id} className={`border-0 shadow-sm hover:shadow-md transition-shadow ${isUpcoming(booking.booking_date) ? 'border-l-4 border-l-blue-500' : ''}`}>
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-lg">
                        {booking.customers.name}
                      </h3>
                      <Badge className={getStatusColor(booking.status)}>
                        {booking.status}
                      </Badge>
                      <Badge variant="outline">
                        {booking.customer_type_at_booking === 'existing' ? 'Existing' : 'New'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="font-medium">Service</p>
                        <p>{booking.services?.name || 'Service not found'}</p>
                      </div>
                      <div>
                        <p className="font-medium">Date & Time</p>
                        <p>{formatDateTime(booking.booking_date, booking.booking_time)}</p>
                      </div>
                      <div>
                        <p className="font-medium">Duration</p>
                        <p>{booking.duration_minutes} min</p>
                      </div>
                      <div>
                        <p className="font-medium">Price</p>
                        <p>{formatPrice(booking.price_charged)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3 text-sm">
                      <span className="text-gray-500">Contact:</span>
                      <span>{booking.customers.email}</span>
                      <span>•</span>
                      <span>{booking.customers.phone}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedBooking(booking)}
                        >
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Booking Details</DialogTitle>
                          <DialogDescription>
                            {booking.customers.name} - {booking.services?.name || 'Service not found'}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          {/* Customer Info */}
                          <div>
                            <h4 className="font-medium mb-2">Customer Information</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p><strong>Name:</strong> {booking.customers.name}</p>
                                <p><strong>Email:</strong> {booking.customers.email}</p>
                                <p><strong>Phone:</strong> {booking.customers.phone}</p>
                              </div>
                              <div>
                                <p><strong>Type:</strong> {booking.customer_type_at_booking}</p>
                                <p><strong>Price Charged:</strong> {formatPrice(booking.price_charged)}</p>
                                <p><strong>Payment Status:</strong> {booking.payment_status}</p>
                              </div>
                            </div>
                          </div>

                          {/* Booking Info */}
                          <div>
                            <h4 className="font-medium mb-2">Booking Information</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p><strong>Service:</strong> {booking.services?.name || 'Service not found'}</p>
                                <p><strong>Duration:</strong> {booking.duration_minutes} minutes</p>
                                <p><strong>Date:</strong> {formatDate(booking.booking_date)}</p>
                              </div>
                              <div>
                                <p><strong>Time:</strong> {formatTime(booking.booking_time)}</p>
                                <p><strong>Status:</strong> {booking.status}</p>
                                <p><strong>Created:</strong> {new Date(booking.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>


                          {/* Actions */}
                          <div className="flex gap-2 pt-4 border-t">
                            <Button
                              variant="destructive"
                              size="lg"
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => {
                                setBookingToDelete(booking.id)
                                setShowDeleteConfirm(true)
                              }}
                            >
                              🗑️ DELETE BOOKING
                            </Button>
                            <Select value={booking.status} onValueChange={(value) => handleStatusChange(booking.id, value)}>
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                                <SelectItem value="no-show">No Show</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Select value={booking.status} onValueChange={(value) => handleStatusChange(booking.id, value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="no-show">No Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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
