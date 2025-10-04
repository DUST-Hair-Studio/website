"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Loader2, Search, Users, UserCheck, UserX, Calendar, DollarSign, Eye, Filter, CheckSquare, Square, Edit } from 'lucide-react'
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

      const data = await response.json()
      
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
    return new Date(dateString).toLocaleDateString()
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Management</h1>
        <p className="text-gray-600">Manage customer types and view customer information</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <UserX className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">New Customers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.new}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Existing Customers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.existing}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.totalRevenue)}</p>
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

      {/* Customers List */}
      <div className="space-y-4">
        {/* Header Row */}
        <div className="flex items-center p-4 bg-gray-50 rounded-lg">
          <div className="w-12">
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
          </div>
          <div className="flex-1 font-medium text-gray-700">Customer</div>
          <div className="w-32 font-medium text-gray-700">Type</div>
          <div className="w-24 font-medium text-gray-700">Bookings</div>
          <div className="w-24 font-medium text-gray-700">Spent</div>
          <div className="w-32 font-medium text-gray-700">Last Booking</div>
          <div className="w-32 font-medium text-gray-700">Actions</div>
        </div>

        {filteredCustomers.map((customer) => (
          <Card key={customer.id}>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="w-12">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCustomerSelection(customer.id)}
                    className="p-1"
                  >
                    {selectedCustomers.has(customer.id) ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div>
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p className="text-sm text-gray-600">{customer.email}</p>
                      <p className="text-sm text-gray-500">{customer.phone}</p>
                    </div>
                  </div>
                </div>

                <div className="w-32">
                  <Badge 
                    variant={customer.is_existing_customer ? "default" : "secondary"}
                    className={customer.is_existing_customer ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}
                  >
                    {customer.is_existing_customer ? 'Existing' : 'New'}
                  </Badge>
                </div>

                <div className="w-24 text-center">
                  <p className="font-medium">{customer.total_bookings}</p>
                </div>

                <div className="w-24 text-center">
                  <p className="font-medium text-green-600">{formatPrice(customer.total_spent)}</p>
                </div>

                <div className="w-32 text-center">
                  <p className="text-sm text-gray-600">
                    {customer.last_booking_date ? formatDate(customer.last_booking_date) : 'Never'}
                  </p>
                </div>

                <div className="w-32 flex items-center space-x-2">
                  <Dialog open={showDetailsDialog && selectedCustomer?.id === customer.id} onOpenChange={(open) => {
                    setShowDetailsDialog(open)
                    if (!open) setSelectedCustomer(null)
                  }}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setShowDetailsDialog(true)
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Customer Details</DialogTitle>
                      </DialogHeader>
                      {selectedCustomer && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Name</Label>
                              <p className="text-sm text-gray-600">{selectedCustomer.name}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Email</Label>
                              <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Phone</Label>
                              <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Customer Type</Label>
                              <Badge 
                                variant={selectedCustomer.is_existing_customer ? "default" : "secondary"}
                                className={selectedCustomer.is_existing_customer ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}
                              >
                                {selectedCustomer.is_existing_customer ? 'Existing' : 'New'}
                              </Badge>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Total Bookings</Label>
                              <p className="text-sm text-gray-600">{selectedCustomer.total_bookings}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Total Spent</Label>
                              <p className="text-sm text-gray-600">{formatPrice(selectedCustomer.total_spent)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(customer)}
                    disabled={isSubmitting}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
            <p className="text-gray-600">
              {searchTerm || filterType !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'No customers have been created yet.'
              }
            </p>
          </div>
        )}
      </div>

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
