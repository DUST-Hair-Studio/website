"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Loader2, Search, Users, UserPlus, User, Calendar, DollarSign, Eye, Filter, CheckSquare, Square, Edit, UserX, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import type { Customer } from '@/types'

interface CustomerWithStats extends Customer {
  total_bookings: number
  last_booking_date?: string
  total_spent: number
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
    is_existing_customer: false,
    notes: ''
  })

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
    return `$${(cents / 100).toFixed(2)}`
  }

  // Format date
  const formatDate = (dateString: string) => {
    // Parse date string without timezone conversion to avoid day shift
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    return date.toLocaleDateString()
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl sm:text-3xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Customers</div>
              </div>
              <div className="h-6 w-6 sm:h-8 sm:w-8 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-200">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl sm:text-3xl font-bold text-gray-900">{stats.new}</div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">New Customers</div>
              </div>
              <div className="h-6 w-6 sm:h-8 sm:w-8 bg-orange-50 rounded-lg flex items-center justify-center border border-orange-200">
                <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 text-orange-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl sm:text-3xl font-bold text-gray-900">{stats.existing}</div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">Existing Customers</div>
              </div>
              <div className="h-6 w-6 sm:h-8 sm:w-8 bg-green-50 rounded-lg flex items-center justify-center border border-green-200">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl sm:text-3xl font-bold text-gray-900">{stats.totalBookings}</div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Bookings</div>
              </div>
              <div className="h-6 w-6 sm:h-8 sm:w-8 bg-purple-50 rounded-lg flex items-center justify-center border border-purple-200">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg sm:text-3xl font-bold text-gray-900">{formatPrice(stats.totalRevenue)}</div>
                <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Revenue</div>
              </div>
              <div className="h-6 w-6 sm:h-8 sm:w-8 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-200">
                <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600" strokeWidth={1.5} />
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
              {/* Mobile Card Layout */}
              <div className="block md:hidden">
                {filteredCustomers.map((customer) => (
                  <div 
                    key={customer.id}
                    className="p-4 border-b border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedCustomer(customer)
                      setShowDetailsDialog(true)
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
                        className={customer.is_existing_customer ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}
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
                        <span className="text-gray-500">Total Spent:</span>
                        <span className="text-green-600">{formatPrice(customer.total_spent)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Last Booking:</span>
                        <span className="text-gray-900">
                          {customer.last_booking_date ? formatDate(customer.last_booking_date) : 'Never'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 px-3 text-xs flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCustomer(customer)
                          setShowDetailsDialog(true)
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View Details
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-8 px-3 text-xs flex-1"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditDialog(customer)
                        }}
                        disabled={isSubmitting}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden md:block overflow-x-auto">
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spent</th>
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
                            className={customer.is_existing_customer ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}
                          >
                            {customer.is_existing_customer ? 'Existing' : 'New'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {customer.total_bookings}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          <span className="text-green-600">{formatPrice(customer.total_spent)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {customer.last_booking_date ? formatDate(customer.last_booking_date) : 'Never'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedCustomer(customer)
                                setShowDetailsDialog(true)
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditDialog(customer)
                              }}
                              disabled={isSubmitting}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
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

      {/* Customer Details Modal */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
            <DialogDescription>
              {selectedCustomer?.name} - Customer Information
            </DialogDescription>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div>
                <h4 className="font-medium mb-2">Customer Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Name:</strong> {selectedCustomer.name}</p>
                    <p><strong>Email:</strong> {selectedCustomer.email}</p>
                    <p><strong>Phone:</strong> {selectedCustomer.phone}</p>
                  </div>
                  <div>
                    <p><strong>Type:</strong> 
                      <Badge 
                        variant={selectedCustomer.is_existing_customer ? "default" : "secondary"}
                        className={`ml-2 ${selectedCustomer.is_existing_customer ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}`}
                      >
                        {selectedCustomer.is_existing_customer ? 'Existing' : 'New'}
                      </Badge>
                    </p>
                    <p><strong>Total Bookings:</strong> {selectedCustomer.total_bookings}</p>
                    <p><strong>Total Spent:</strong> {formatPrice(selectedCustomer.total_spent)}</p>
                  </div>
                </div>
              </div>

              {/* Booking Stats */}
              <div>
                <h4 className="font-medium mb-2">Booking Statistics</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Total Bookings:</strong> {selectedCustomer.total_bookings}</p>
                    <p><strong>Total Spent:</strong> {formatPrice(selectedCustomer.total_spent)}</p>
                  </div>
                  <div>
                    <p><strong>Last Booking:</strong> {selectedCustomer.last_booking_date ? formatDate(selectedCustomer.last_booking_date) : 'Never'}</p>
                    <p><strong>Customer Since:</strong> {formatDate(selectedCustomer.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedCustomer.notes && (
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">{selectedCustomer.notes}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailsDialog(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowDetailsDialog(false)
                    openEditDialog(selectedCustomer)
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Customer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </div>
  )
}
