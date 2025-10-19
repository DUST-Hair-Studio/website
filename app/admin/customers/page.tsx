"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Loader2, Search, Users, UserPlus, User, DollarSign, Filter, CheckSquare, Square, Edit, UserX, UserCheck, Phone, MessageSquare, Mail, Calendar, Clock, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import type { Customer } from '@/types'

interface CustomerWithStats extends Customer {
  total_bookings: number
  last_booking_date?: string
  last_booking_price?: number
  total_spent: number
  birthday?: string
}

interface BillingHistoryItem {
  id: string
  date: string
  time: string
  service: string
  duration: number
  amount: number
  paymentStatus: 'pending' | 'paid' | 'refunded'
  bookingStatus: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  paidAt?: string
  squareTransactionId?: string
  createdAt: string
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'new' | 'existing'>('all')
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithStats | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    birthday: '',
    is_existing_customer: false,
    notes: ''
  })
  const [activePhoneMenu, setActivePhoneMenu] = useState<string | null>(null)
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([])
  const [loadingBillingHistory, setLoadingBillingHistory] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BillingHistoryItem | null>(null)
  const [showBookingDetails, setShowBookingDetails] = useState(false)

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/customers')
      
      if (!response.ok) {
        throw new Error('Failed to fetch customers')
      }
      
      const data = await response.json()
      setCustomers(data.customers || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [])

  // Fetch billing history for selected customer
  const fetchBillingHistory = async (customerId: string) => {
    try {
      setLoadingBillingHistory(true)
      const response = await fetch(`/api/admin/customers/${customerId}/billing-history`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch billing history')
      }
      
      const data = await response.json()
      setBillingHistory(data.billingHistory || [])
    } catch (error) {
      console.error('Error fetching billing history:', error)
      toast.error('Failed to load billing history')
    } finally {
      setLoadingBillingHistory(false)
    }
  }

  // Open booking details modal
  const openBookingDetails = (booking: BillingHistoryItem) => {
    setSelectedBooking(booking)
    setShowBookingDetails(true)
  }

  // Handle URL parameters to auto-open customer details modal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const customerId = urlParams.get('customerId')
    const searchParam = urlParams.get('search')
    
    if (customerId && customers.length > 0) {
      const customer = customers.find(c => c.id === customerId)
      if (customer) {
        setSelectedCustomer(customer)
        setShowDetailsDialog(true)
        fetchBillingHistory(customer.id)
        // Clean up the URL parameter
        const newUrl = window.location.pathname
        window.history.replaceState({}, '', newUrl)
      }
    }
    
    // Set search term if provided in URL
    if (searchParam) {
      setSearchTerm(searchParam)
    }
  }, [customers])

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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showDetailsDialog || showBookingDetails) {
      // Prevent scrolling on the body
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      document.body.style.height = '100%'
    } else {
      // Restore scrolling
      document.body.style.overflow = 'unset'
      document.body.style.position = 'unset'
      document.body.style.width = 'unset'
      document.body.style.height = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
      document.body.style.position = 'unset'
      document.body.style.width = 'unset'
      document.body.style.height = 'unset'
    }
  }, [showDetailsDialog, showBookingDetails])

  // const renderPhoneNumber = (phone: string, customerId: string, className: string = "text-blue-500 hover:text-blue-700 underline cursor-pointer") => {
  //   const isActive = activePhoneMenu === customerId
  //   
  //   return (
  //     <div className="relative inline-block">
  //       <button
  //         onClick={(e) => {
  //           e.stopPropagation()
  //           setActivePhoneMenu(isActive ? null : customerId)
  //         }}
  //         className={className}
  //       >
  //         {phone}
  //       </button>
  //       
  //       {isActive && (
  //         <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[120px]">
  //           <button
  //             onClick={(e) => {
  //               e.stopPropagation()
  //               window.open(`tel:${phone}`, '_self')
  //               setActivePhoneMenu(null)
  //             }}
  //             className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
  //           >
  //             <Phone className="w-3 h-3" />
  //             Call
  //           </button>
  //           <button
  //             onClick={(e) => {
  //               e.stopPropagation()
  //               window.open(`sms:${phone}`, '_self')
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

  // Filter customers based on search and type
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm)
    
    const matchesFilter = 
      filterType === 'all' ||
      (filterType === 'new' && !customer.is_existing_customer) ||
      (filterType === 'existing' && customer.is_existing_customer)
    
    return matchesSearch && matchesFilter
  })

  // Open edit dialog
  const openEditDialog = (customer: CustomerWithStats) => {
    setEditingCustomer(customer)
    setEditForm({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      birthday: customer.birthday || '',
      is_existing_customer: customer.is_existing_customer,
      notes: customer.notes || ''
    })
    setShowEditDialog(true)
  }

  // Save customer edits
  const saveCustomerEdit = async () => {
    if (!editingCustomer) return

    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/admin/customers/${editingCustomer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm)
      })

      if (!response.ok) {
        throw new Error('Failed to update customer')
      }

      await response.json()
      
      // Update local state
      setCustomers(prev => prev.map(c => 
        c.id === editingCustomer.id 
          ? { ...c, ...editForm }
          : c
      ))

      setShowEditDialog(false)
      setEditingCustomer(null)
      toast.success('Customer updated successfully')
    } catch (error) {
      console.error('Error updating customer:', error)
      toast.error('Failed to update customer')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bulk update customer types
  const bulkUpdateCustomerTypes = async (isExisting: boolean) => {
    if (selectedCustomers.size === 0) return

    try {
      setIsSubmitting(true)
      const response = await fetch('/api/admin/customers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerIds: Array.from(selectedCustomers),
          is_existing_customer: isExisting
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update customers')
      }

      const data = await response.json()
      
      // Update local state
      setCustomers(prev => prev.map(c => 
        selectedCustomers.has(c.id)
          ? { ...c, is_existing_customer: isExisting }
          : c
      ))

      setSelectedCustomers(new Set())
      toast.success(`Updated ${data.customers.length} customers to ${isExisting ? 'existing' : 'new'} status`)
    } catch (error) {
      console.error('Error bulk updating customers:', error)
      toast.error('Failed to update customers')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle customer selection
  const toggleCustomerSelection = (customerId: string) => {
    const newSelection = new Set(selectedCustomers)
    if (newSelection.has(customerId)) {
      newSelection.delete(customerId)
    } else {
      newSelection.add(customerId)
    }
    setSelectedCustomers(newSelection)
  }

  // Select all customers
  const selectAllCustomers = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set())
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)))
    }
  }

  // Format price
  const formatPrice = (cents: number) => {
    return `$${Math.round(cents / 100)}`
  }

  // Format date - handle both YYYY-MM-DD and ISO timestamp formats
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    
    // If it's a YYYY-MM-DD format, parse manually to avoid timezone issues
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number)
      const date = new Date(year, month - 1, day) // month is 0-indexed
      return date.toLocaleDateString()
    }
    
    // For ISO timestamps, use normal Date parsing
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  // Format time in 12-hour format with correct timezone
  const formatTime = (dateString: string, timeString: string) => {
    if (!dateString || !timeString) return 'N/A'
    
    try {
      // Create a date object by combining date and time
      const [year, month, day] = dateString.split('-').map(Number)
      const [hour, minute] = timeString.split(':').map(Number)
      
      // Create date in the business timezone (America/Los_Angeles)
      const date = new Date(year, month - 1, day, hour, minute)
      
      // Format in 12-hour format with timezone
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Los_Angeles'
      })
    } catch (error) {
      console.error('Error formatting time:', error)
      return timeString // Fallback to original time
    }
  }

  // Get customer stats
  const stats = {
    total: customers.length,
    new: customers.filter(c => !c.is_existing_customer).length,
    existing: customers.filter(c => c.is_existing_customer).length,
    totalBookings: customers.reduce((sum, c) => sum + c.total_bookings, 0),
    totalRevenue: customers.reduce((sum, c) => sum + c.total_spent, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading customers...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Customer Management</h1>
        <p className="text-gray-600 text-sm sm:text-base">Manage customer types and view customer information</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{stats.total}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 sm:h-6 sm:w-6 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-200">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Total Customers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-lg sm:text-3xl font-bold text-gray-900 mb-2">{formatPrice(stats.totalRevenue)}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 sm:h-6 sm:w-6 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-200">
                  <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Total Revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">{stats.new}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 sm:h-6 sm:w-6 bg-orange-50 rounded-lg flex items-center justify-center border border-orange-200">
                  <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs sm:text-sm text-gray-600">New Customers</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">{stats.existing}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 sm:h-6 sm:w-6 bg-green-50 rounded-lg flex items-center justify-center border border-green-200">
                  <User className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Existing Customers</div>
              </div>
            </div>
          </CardContent>
        </Card>



      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search customers by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'new' | 'existing')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Customers</option>
            <option value="new">New Customers</option>
            <option value="existing">Existing Customers</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedCustomers.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-blue-800 font-medium">
              {selectedCustomers.size} customer{selectedCustomers.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkUpdateCustomerTypes(false)}
                disabled={isSubmitting}
              >
                <UserX className="w-4 h-4 mr-2" />
                Mark as New
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => bulkUpdateCustomerTypes(true)}
                disabled={isSubmitting}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Mark as Existing
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomers(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Customers Table */}
      <Card className="border border-gray-200 shadow-sm">
        <CardContent className="p-0">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
              <p className="text-gray-600">
                {searchTerm || filterType !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'No customers have been created yet.'
                }
              </p>
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Card Layout */}
              <div className="block lg:hidden">
                {filteredCustomers.map((customer) => (
                  <div 
                    key={customer.id}
                    className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedCustomer(customer)
                      setShowDetailsDialog(true)
                      fetchBillingHistory(customer.id)
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleCustomerSelection(customer.id)
                          }}
                          className="p-1"
                        >
                          {selectedCustomers.has(customer.id) ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </Button>
                        <div>
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          <div className="text-sm text-gray-500">{customer.email}</div>
                          <div className="text-sm text-gray-500">{customer.phone}</div>
                        </div>
                      </div>
                      <Badge 
                        variant={customer.is_existing_customer ? "default" : "secondary"}
                        className={customer.is_existing_customer ? "bg-indigo-100 text-indigo-800" : "bg-purple-100 text-purple-800"}
                      >
                        {customer.is_existing_customer ? 'Existing' : 'New'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Bookings:</span>
                        <span className="text-gray-900">{customer.total_bookings}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Last Booking:</span>
                        <div className="text-right">
                          <div className="text-gray-900">
                            {customer.last_booking_date ? formatDate(customer.last_booking_date) : 'Never'}
                          </div>
                          {customer.last_booking_price && (
                            <div className="text-xs text-gray-500">{formatPrice(customer.last_booking_price)}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditDialog(customer)
                        }}
                        disabled={isSubmitting}
                        title="Edit customer"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={selectAllCustomers}
                          className="p-1"
                        >
                          {selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0 ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </Button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Booking</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCustomers.map((customer) => (
                      <tr 
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setShowDetailsDialog(true)
                          fetchBillingHistory(customer.id)
                        }}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleCustomerSelection(customer.id)
                            }}
                            className="p-1"
                          >
                            {selectedCustomers.has(customer.id) ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </Button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                            <div className="text-sm text-gray-500">{customer.phone}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge 
                            variant={customer.is_existing_customer ? "default" : "secondary"}
                            className={customer.is_existing_customer ? "bg-indigo-100 text-indigo-800" : "bg-purple-100 text-purple-800"}
                          >
                            {customer.is_existing_customer ? 'Existing' : 'New'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {customer.total_bookings}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div>{customer.last_booking_date ? formatDate(customer.last_booking_date) : 'Never'}</div>
                            {customer.last_booking_price && (
                              <div className="text-xs text-gray-500">{formatPrice(customer.last_booking_price)}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditDialog(customer)
                            }}
                            disabled={isSubmitting}
                            title="Edit customer"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
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

      {/* Customer Details Modal - Proper Slide-up Implementation */}
      {showDetailsDialog && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 md:bg-black/20 touch-none"
            onClick={() => setShowDetailsDialog(false)}
            onTouchMove={(e) => e.preventDefault()}
          />
          
          {/* Modal Content */}
          <div className="fixed bottom-0 left-0 right-0 md:bottom-0 md:left-auto md:right-0 md:top-0 md:w-[500px] md:h-full bg-white rounded-t-3xl md:rounded-none md:rounded-l-xl shadow-xl md:shadow-2xl max-h-[90vh] md:max-h-none">
            {/* Mobile Slide-up Container */}
            <div className="h-full flex flex-col md:flex md:flex-col md:h-full overflow-hidden">
              {/* Drag Handle for Mobile */}
              <div className="flex justify-center pt-3 pb-2 md:hidden">
                <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
              </div>
              
              {/* Header */}
              <div className="px-6 pb-4 border-b border-gray-200 md:border-none md:px-6 md:pt-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedCustomer?.name}
                    </h2>
                  </div>
                  {selectedCustomer && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`tel:${selectedCustomer.phone}`, '_self')}
                        className="h-10 w-10 p-0"
                        title={`Call ${selectedCustomer.name}`}
                      >
                        <Phone className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`sms:${selectedCustomer.phone}`, '_self')}
                        className="h-10 w-10 p-0"
                        title={`Text ${selectedCustomer.name}`}
                      >
                        <MessageSquare className="w-5 h-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`mailto:${selectedCustomer.email}`, '_self')}
                        className="h-10 w-10 p-0"
                        title={`Email ${selectedCustomer.name}`}
                      >
                        <Mail className="w-5 h-5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
          
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 md:px-6 md:py-4 min-h-0" style={{ WebkitOverflowScrolling: 'touch', maxHeight: 'calc(90vh - 200px)', height: '400px' }}>
              {selectedCustomer && (
                <div className="space-y-4 md:space-y-6 pb-4 md:pb-6">
                  {/* Customer Info */}
                  <div className="pb-6 md:pb-8 pt-4 md:border-t md:border-b md:border-gray-300">
                    <h4 className="font-semibold text-gray-900 mb-3 md:mb-4 text-lg">Customer Information</h4>
                    <div className="space-y-3 md:space-y-4">
                          <div className="flex justify-between items-center py-2 md:py-2">
                            <span className="text-gray-600">Customer</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{selectedCustomer.name}</span>
                              <Badge
                                variant={selectedCustomer.is_existing_customer ? "default" : "secondary"}
                                className={`${selectedCustomer.is_existing_customer ? "bg-indigo-100 text-indigo-800" : "bg-purple-100 text-purple-800"}`}
                              >
                                {selectedCustomer.is_existing_customer ? 'Existing' : 'New'}
                              </Badge>
                            </div>
                          </div>
                      <div className="flex justify-between items-center py-2 md:py-2">
                        <span className="text-gray-600">Customer Since</span>
                        <span className="font-medium text-gray-900">{formatDate(selectedCustomer.created_at)}</span>
                      </div>
                      {selectedCustomer.birthday && (
                        <div className="flex justify-between items-center py-2 md:py-2">
                          <span className="text-gray-600">Birthday</span>
                          <span className="font-medium text-gray-900">{formatDate(selectedCustomer.birthday)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-start py-2 md:py-2">
                        <span className="text-gray-600">Notes</span>
                        <div className="flex items-start gap-3 flex-1 justify-end">
                          <div className="flex-1 max-w-[70%]">
                            {selectedCustomer.notes ? (
                              <span className="font-medium text-gray-900 break-words">{selectedCustomer.notes}</span>
                            ) : (
                              <span className="text-gray-400 text-sm">No notes</span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowDetailsDialog(false)
                              if (selectedCustomer) {
                                openEditDialog(selectedCustomer)
                              }
                            }}
                            className="h-6 w-6 p-0 hover:bg-gray-100 flex-shrink-0"
                            title="Edit notes"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Booking Stats */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 md:mb-4 text-lg">Booking Statistics</h4>
                    <div className="space-y-2 md:space-y-4">
                      <div className="flex justify-between items-center py-1 md:py-2">
                        <span className="text-gray-600">Total Spent</span>
                        <span className="font-medium text-gray-900">{formatPrice(selectedCustomer.total_spent)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Booking History */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3 md:mb-4 text-lg">Booking History</h4>
                    {loadingBillingHistory ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="ml-2 text-gray-600">Loading billing history...</span>
                      </div>
                    ) : billingHistory.length > 0 ? (
                      <div className="space-y-3">
                        {billingHistory.map((item) => (
                          <div 
                            key={item.id} 
                            className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => openBookingDetails(item)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Calendar className="w-4 h-4 text-gray-500" />
                                  <span className="font-medium text-gray-900">{formatDate(item.date)}</span>
                                  <Clock className="w-4 h-4 text-gray-500 ml-2" />
                                  <span className="text-gray-600">{formatTime(item.date, item.time)}</span>
                                </div>
                                <div className="text-sm text-gray-600 mb-2">
                                  {item.service} ({item.duration} min)
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                                  <div className="flex items-center gap-1">
                                    <CreditCard className="w-4 h-4 text-gray-500" />
                                    <span className="text-gray-600">Payment:</span>
                                    <Badge 
                                      variant={item.paymentStatus === 'paid' ? 'default' : item.paymentStatus === 'refunded' ? 'destructive' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {item.paymentStatus}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-600">Status:</span>
                                    <Badge 
                                      variant={item.bookingStatus === 'completed' ? 'default' : item.bookingStatus === 'cancelled' ? 'destructive' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {item.bookingStatus}
                                    </Badge>
                                  </div>
                                </div>
                                {item.squareTransactionId && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Square ID: {item.squareTransactionId}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-gray-900">{formatPrice(item.amount)}</div>
                                {item.paidAt && (
                                  <div className="text-xs text-gray-500">
                                    Paid: {formatDate(item.paidAt)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No billing history found</p>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white md:px-6 md:py-6 md:border-none">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsDialog(false)}
                  className="flex-1 h-12"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowDetailsDialog(false)
                    if (selectedCustomer) {
                      openEditDialog(selectedCustomer)
                    }
                  }}
                  className="flex-1 h-12 text-black border border-black"
                  style={{ backgroundColor: '#a7f3d0' }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Customer
                </Button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Customer name"
              />
            </div>

            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="customer@example.com"
              />
            </div>

            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <Label htmlFor="edit-birthday">Birthday</Label>
              <Input
                id="edit-birthday"
                type="date"
                value={editForm.birthday || ''}
                onChange={(e) => setEditForm(prev => ({ ...prev, birthday: e.target.value }))}
                placeholder="YYYY-MM-DD"
              />
            </div>

            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Customer notes..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-customer-type"
                checked={editForm.is_existing_customer}
                onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, is_existing_customer: checked }))}
              />
              <Label htmlFor="edit-customer-type">
                Existing Customer
              </Label>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={saveCustomerEdit}
              disabled={isSubmitting}
              className="text-black border border-black"
              style={{ backgroundColor: '#a7f3d0' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Details Modal */}
      {showBookingDetails && selectedBooking && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 md:bg-black/20 touch-none"
            onClick={() => setShowBookingDetails(false)}
            onTouchMove={(e) => e.preventDefault()}
          />
          
          {/* Modal Content */}
          <div className="fixed bottom-0 left-0 right-0 md:bottom-0 md:left-auto md:right-0 md:top-0 md:w-[500px] md:h-full bg-white rounded-t-3xl md:rounded-none md:rounded-l-xl shadow-xl md:shadow-2xl max-h-[90vh] md:max-h-none">
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
                        {selectedBooking.service}
                      </h2>
                      <div className="text-sm font-normal text-gray-600">
                        ({selectedBooking.duration} min)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 md:px-6 md:py-4 min-h-0" style={{ WebkitOverflowScrolling: 'touch', maxHeight: 'calc(90vh - 200px)' }}>
                <div className="space-y-6 pb-4 md:pb-6">
                  {/* Customer Information */}
                  <div className="pt-4">
                    <h4 className="font-semibold text-gray-900 mb-4 text-lg">Customer Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Customer</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{selectedCustomer?.name || 'N/A'}</span>
                          <Badge
                            variant={selectedCustomer?.is_existing_customer ? "default" : "secondary"}
                            className={`${selectedCustomer?.is_existing_customer ? "bg-indigo-100 text-indigo-800" : "bg-purple-100 text-purple-800"}`}
                          >
                            {selectedCustomer?.is_existing_customer ? 'existing' : 'new'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Booking Information */}
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="font-semibold text-gray-900 mb-4 text-lg">Booking Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-start py-2">
                        <span className="text-gray-600">Date & Time</span>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">{formatDate(selectedBooking.date)}</div>
                          <div className="text-sm text-gray-600">{formatTime(selectedBooking.date, selectedBooking.time)}</div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Status</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          selectedBooking.bookingStatus === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : selectedBooking.bookingStatus === 'cancelled' 
                            ? 'bg-red-100 text-red-800' 
                            : selectedBooking.bookingStatus === 'confirmed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedBooking.bookingStatus}
                        </span>
                      </div>
                      <div className="flex justify-between items-start py-2">
                        <span className="text-gray-600">Payment</span>
                        <div className="text-right">
                          <div className="font-medium text-gray-900">{formatPrice(selectedBooking.amount)}</div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                            selectedBooking.paymentStatus === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : selectedBooking.paymentStatus === 'refunded' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {selectedBooking.paymentStatus}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-gray-600">Created</span>
                        <span className="font-medium text-gray-900">{formatDate(selectedBooking.createdAt)}</span>
                      </div>
                      {selectedBooking.squareTransactionId && (
                        <div className="flex justify-between items-start py-2">
                          <span className="text-gray-600">Square ID</span>
                          <span className="font-medium text-gray-900 text-right break-all">{selectedBooking.squareTransactionId}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
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
                    disabled={selectedBooking.paymentStatus === 'paid'}
                    className="flex-1 h-12"
                    title={selectedBooking.paymentStatus === 'paid' ? 'Cannot delete paid bookings to maintain financial integrity' : 'Delete booking'}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Booking
                  </Button>
                </div>
                {selectedBooking.paymentStatus === 'paid' && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Cannot delete paid bookings to maintain financial integrity
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
