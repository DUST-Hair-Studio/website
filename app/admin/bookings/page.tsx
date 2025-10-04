'use client'

import { useState, useEffect } from 'react'
import { Booking } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CardHeader, CardTitle } from '@/components/ui/card'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Calendar } from '@/components/ui/calendar'

interface BookingWithDetails extends Booking {
  services: {
    name: string;
    description: string;
    duration_minutes: number;
  };
  customers: {
    first_name: string;
    last_name: string;
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
      booking.customers.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customers.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.customers.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.services.name.toLowerCase().includes(searchTerm.toLowerCase())
    
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

  const handleCustomerTypeToggle = async (customerId: string, isExisting: boolean) => {
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_existing_customer: !isExisting })
      })

      if (response.ok) {
        setBookings(prev => 
          prev.map(booking => 
            booking.customer_id === customerId 
              ? { 
                  ...booking, 
                  customers: { 
                    ...booking.customers, 
                    is_existing_customer: !isExisting 
                  } 
                }
              : booking
          )
        )
      }
    } catch (error) {
      console.error('Error updating customer type:', error)
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

  const formatDateTime = (date: string, time: string) => {
    const bookingDate = new Date(date)
    return `${bookingDate.toLocaleDateString()} at ${time}`
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
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
            <Card key={booking.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-lg">
                        {booking.customers.first_name} {booking.customers.last_name}
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
                        <p>{booking.services.name}</p>
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
                            {booking.customers.first_name} {booking.customers.last_name} - {booking.services.name}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          {/* Customer Info */}
                          <div>
                            <h4 className="font-medium mb-2">Customer Information</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p><strong>Name:</strong> {booking.customers.first_name} {booking.customers.last_name}</p>
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
                                <p><strong>Service:</strong> {booking.services.name}</p>
                                <p><strong>Duration:</strong> {booking.duration_minutes} minutes</p>
                                <p><strong>Date:</strong> {new Date(booking.booking_date).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p><strong>Time:</strong> {booking.booking_time}</p>
                                <p><strong>Status:</strong> {booking.status}</p>
                                <p><strong>Created:</strong> {new Date(booking.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>

                          {/* Notes */}
                          <div>
                            <Label htmlFor="customerNotes">Customer Notes</Label>
                            <Textarea
                              id="customerNotes"
                              value={booking.customer_notes || ''}
                              readOnly
                              className="mt-1"
                            />
                          </div>

                          <div>
                            <Label htmlFor="adminNotes">Admin Notes</Label>
                            <Textarea
                              id="adminNotes"
                              value={booking.admin_notes || ''}
                              readOnly
                              className="mt-1"
                            />
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-4 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCustomerTypeToggle(
                                booking.customer_id, 
                                booking.customers.is_existing_customer
                              )}
                            >
                              {booking.customers.is_existing_customer ? 'Mark as New' : 'Mark as Existing'}
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
    </div>
  )
}
