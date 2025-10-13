'use client'

import { useState, useEffect } from 'react'
import { Service } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  console.log('🔍 AdminServicesPage: loading=', loading, 'services count=', services.length)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_minutes: '',
    new_customer_price: '',
    existing_customer_price: '',
    is_active: true,
    is_existing_customer: true,
    is_new_customer: true,
    category: '',
    sort_order: ''
  })

  // Fetch all services
  useEffect(() => {
    const fetchServices = async () => {
      console.log('🔍 Fetching services...')
      try {
        const response = await fetch('/api/admin/services')
        console.log('🔍 Services response status:', response.status)
        const data = await response.json()
        console.log('🔍 Services data:', data)
        setServices(data.services || [])
      } catch (error) {
        console.error('❌ Error fetching services:', error)
      } finally {
        console.log('🔍 Setting loading to false')
        setLoading(false)
      }
    }

    fetchServices()
  }, [])

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration_minutes: '',
      new_customer_price: '',
      existing_customer_price: '',
      is_active: true,
      is_existing_customer: true,
      is_new_customer: true,
      category: '',
      sort_order: ''
    })
  }

  const openCreateDialog = () => {
    resetForm()
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = (service: Service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description || '',
      duration_minutes: service.duration_minutes.toString(),
      new_customer_price: (service.new_customer_price / 100).toString(), // Convert from cents
      existing_customer_price: (service.existing_customer_price / 100).toString(), // Convert from cents
      is_active: service.is_active,
      is_existing_customer: service.is_existing_customer,
      is_new_customer: service.is_new_customer,
      category: service.category || '',
      sort_order: service.sort_order.toString()
    })
    setIsEditDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const submitData = {
        ...formData,
        duration_minutes: parseInt(formData.duration_minutes),
        new_customer_price: Math.round(parseFloat(formData.new_customer_price) * 100), // Convert to cents
        existing_customer_price: Math.round(parseFloat(formData.existing_customer_price) * 100), // Convert to cents
        sort_order: parseInt(formData.sort_order) || 0
      }

      let response
      if (editingService) {
        // Update existing service
        response = await fetch(`/api/admin/services/${editingService.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData)
        })
      } else {
        // Create new service
        response = await fetch('/api/admin/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData)
        })
      }

      if (response.ok) {
        // Refresh services list
        const updatedResponse = await fetch('/api/admin/services')
        const updatedData = await updatedResponse.json()
        setServices(updatedData.services || [])
        
        setIsCreateDialogOpen(false)
        setIsEditDialogOpen(false)
        setEditingService(null)
        resetForm()
        
        toast.success(editingService ? 'Service updated successfully!' : 'Service created successfully!')
      } else {
        const error = await response.json()
        console.error('Error saving service:', error)
        toast.error(error.error || 'Failed to save service')
      }
    } catch (error) {
      console.error('Error saving service:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (serviceId: string) => {
    console.log('🔍 Attempting to delete service:', serviceId)
    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'DELETE'
      })

      console.log('🔍 Delete response status:', response.status)
      const responseData = await response.json()
      console.log('🔍 Delete response data:', responseData)

      if (response.ok) {
        // Refresh services list
        console.log('🔍 Refreshing services list...')
        const updatedResponse = await fetch('/api/admin/services')
        const updatedData = await updatedResponse.json()
        console.log('🔍 Updated services:', updatedData.services)
        setServices(updatedData.services || [])
        toast.success('Service deleted successfully!')
      } else {
        console.error('❌ Delete failed:', responseData)
        toast.error(responseData.error || 'Failed to delete service')
      }
    } catch (error) {
      console.error('❌ Error deleting service:', error)
      toast.error('An error occurred while deleting the service')
    }
  }

  const toggleServiceStatus = async (service: Service) => {
    try {
      const response = await fetch(`/api/admin/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !service.is_active })
      })

      if (response.ok) {
        // Refresh services list
        const updatedResponse = await fetch('/api/admin/services')
        const updatedData = await updatedResponse.json()
        setServices(updatedData.services || [])
        toast.success(`Service ${!service.is_active ? 'activated' : 'deactivated'} successfully!`)
      }
    } catch (error) {
      console.error('Error toggling service status:', error)
    }
  }

  const formatPrice = (priceInCents: number) => {
    return `$${Math.round(priceInCents / 100)}`
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${mins}m`
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center">
          <div className="text-lg">Loading services...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-4 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Service Management</h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">Manage your salon services and pricing</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Service</DialogTitle>
              <DialogDescription>
                Add a new service with dual pricing for new and existing customers.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Service Details Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Service Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Service Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Enter service name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g., Haircut, Color, Treatment"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Describe the service details..."
                  />
                </div>
              </div>

              {/* Pricing and Duration Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Pricing and Duration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration_minutes" className="text-sm font-medium">
                      Duration (minutes) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="duration_minutes"
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                      required
                      min="15"
                      step="15"
                      placeholder="60"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_customer_price" className="text-sm font-medium">
                      New Customer Price <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="new_customer_price"
                      type="number"
                      step="0.01"
                      value={formData.new_customer_price}
                      onChange={(e) => setFormData({ ...formData, new_customer_price: e.target.value })}
                      required
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="existing_customer_price" className="text-sm font-medium">
                      Existing Customer Price <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="existing_customer_price"
                      type="number"
                      step="0.01"
                      value={formData.existing_customer_price}
                      onChange={(e) => setFormData({ ...formData, existing_customer_price: e.target.value })}
                      required
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Availability and Settings Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Availability and Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="sort_order" className="text-sm font-medium">Sort Order</Label>
                    <Input
                      id="sort_order"
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_active" className="text-sm font-medium">Active</Label>
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_existing_customer" className="text-sm font-medium">Available to Existing Customers</Label>
                      <Switch
                        id="is_existing_customer"
                        checked={formData.is_existing_customer}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_existing_customer: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="is_new_customer" className="text-sm font-medium">Available to New Customers</Label>
                      <Switch
                        id="is_new_customer"
                        checked={formData.is_new_customer}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_new_customer: checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Service
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Services List */}
      <div className="grid gap-6">
        {services.filter(service => service.is_active).map((service) => (
          <Card key={service.id} className={!service.is_active ? 'opacity-60' : ''}>
            <CardHeader>
              {/* Mobile-first header layout */}
              <div className="space-y-4">
                {/* Top row: Service name and status */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-xl break-words">{service.name}</CardTitle>
                    {service.category && (
                      <Badge variant="secondary" className="mt-2 w-fit">
                        {service.category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {service.is_active ? (
                      <Badge variant="default" className="bg-green-100 text-green-800 w-fit">
                        <Eye className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-800 w-fit">
                        <EyeOff className="w-3 h-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Action buttons - mobile-friendly layout */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleServiceStatus(service)}
                    className="w-full sm:w-auto"
                  >
                    {service.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(service)}
                      className="flex-1 sm:flex-none"
                    >
                      <Edit className="w-4 h-4 sm:mr-2" />
                      <span className="sm:hidden">Edit</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 sm:mr-2" />
                          <span className="sm:hidden">Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent 
                        className="bg-white border border-gray-200 shadow-xl"
                        style={{ backgroundColor: 'white', opacity: 1 }}
                      >
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Service</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{service.name}&quot;? This action cannot be undone.
                            {service.is_active && (
                              <span className="block mt-2 text-yellow-600">
                                ⚠️ This service is currently active and visible to customers.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(service.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete Service
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mobile-optimized content grid */}
              <div className="space-y-4 sm:space-y-0">
                {/* Mobile: Stack all items vertically */}
                <div className="block sm:hidden space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-600">Duration</p>
                    <p className="text-lg font-semibold">{formatDuration(service.duration_minutes)}</p>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-600">New Customer Price</p>
                    <p className="text-lg font-bold text-purple-600">{formatPrice(service.new_customer_price)}</p>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-600">Existing Customer Price</p>
                    <p className="text-lg font-bold text-indigo-600">{formatPrice(service.existing_customer_price)}</p>
                  </div>
                  <div className="py-2">
                    <p className="text-sm font-medium text-gray-600 mb-2">Availability</p>
                    <div className="flex flex-wrap gap-2">
                      {service.is_new_customer && (
                        <Badge className="bg-purple-100 text-purple-800">New Customers</Badge>
                      )}
                      {service.is_existing_customer && (
                        <Badge className="bg-indigo-100 text-indigo-800">Existing Customers</Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Desktop: Grid layout */}
                <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Duration</p>
                    <p className="text-lg">{formatDuration(service.duration_minutes)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">New Customer Price</p>
                    <p className="text-lg font-bold text-purple-600">{formatPrice(service.new_customer_price)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Existing Customer Price</p>
                    <p className="text-lg font-bold text-indigo-600">{formatPrice(service.existing_customer_price)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Availability</p>
                    <div className="flex flex-col space-y-1">
                      {service.is_new_customer && (
                        <Badge className="w-fit bg-purple-100 text-purple-800">New Customers</Badge>
                      )}
                      {service.is_existing_customer && (
                        <Badge className="w-fit bg-indigo-100 text-indigo-800">Existing Customers</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {service.description && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600 leading-relaxed">{service.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inactive Services Section */}
      {services.filter(service => !service.is_active).length > 0 && (
        <div className="mt-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Inactive Services</h2>
            <p className="text-gray-600 mt-2">Services that are currently disabled and not visible to customers</p>
          </div>
          
          <div className="grid gap-6">
            {services.filter(service => !service.is_active).map((service) => (
              <Card key={service.id} className="opacity-60 border-gray-200">
                <CardHeader>
                  {/* Mobile-first header layout for inactive services */}
                  <div className="space-y-4">
                    {/* Top row: Service name and status */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl text-gray-600 break-words">{service.name}</CardTitle>
                        {service.category && (
                          <Badge variant="secondary" className="mt-2 w-fit bg-gray-100 text-gray-600">
                            {service.category}
                          </Badge>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <Badge variant="secondary" className="bg-gray-100 text-gray-800 w-fit">
                          <Eye className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Action buttons - mobile-friendly layout */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleServiceStatus(service)}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto"
                      >
                        <Eye className="w-4 h-4 sm:mr-2" />
                        Activate
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(service)}
                          className="flex-1 sm:flex-none"
                        >
                          <Edit className="w-4 h-4 sm:mr-2" />
                          <span className="sm:hidden">Edit</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 sm:flex-none text-red-600 hover:text-red-700">
                              <Trash2 className="w-4 h-4 sm:mr-2" />
                              <span className="sm:hidden">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Service</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{service.name}&quot;? This action cannot be undone.
                                If this service has existing bookings, it cannot be deleted and should remain deactivated instead.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(service.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete Service
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Mobile-optimized content grid for inactive services */}
                  <div className="space-y-4 sm:space-y-0">
                    {/* Mobile: Stack all items vertically */}
                    <div className="block sm:hidden space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-600">Duration</p>
                        <p className="text-lg font-semibold text-gray-500">{formatDuration(service.duration_minutes)}</p>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-600">New Customer Price</p>
                        <p className="text-lg font-bold text-gray-500">{formatPrice(service.new_customer_price)}</p>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-600">Existing Customer Price</p>
                        <p className="text-lg font-bold text-gray-500">{formatPrice(service.existing_customer_price)}</p>
                      </div>
                      <div className="py-2">
                        <p className="text-sm font-medium text-gray-600 mb-2">Availability</p>
                        <div className="flex flex-wrap gap-2">
                          {service.is_new_customer && (
                            <Badge className="bg-purple-100 text-purple-800">New Customers</Badge>
                          )}
                          {service.is_existing_customer && (
                            <Badge className="bg-indigo-100 text-indigo-800">Existing Customers</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Desktop: Grid layout */}
                    <div className="hidden sm:grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Duration</p>
                        <p className="text-lg font-bold text-gray-500">{formatDuration(service.duration_minutes)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">New Customer Price</p>
                        <p className="text-lg font-bold text-gray-500">{formatPrice(service.new_customer_price)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Existing Customer Price</p>
                        <p className="text-lg font-bold text-gray-500">{formatPrice(service.existing_customer_price)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Availability</p>
                        <div className="flex flex-col space-y-1">
                          {service.is_new_customer && (
                            <Badge className="w-fit bg-purple-100 text-purple-800">New Customers</Badge>
                          )}
                          {service.is_existing_customer && (
                            <Badge className="w-fit bg-indigo-100 text-indigo-800">Existing Customers</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {service.description && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-500 leading-relaxed">{service.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Edit Service Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>
              Update the service details and pricing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Service Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Service Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name" className="text-sm font-medium">
                    Service Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Enter service name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category" className="text-sm font-medium">Category</Label>
                  <Input
                    id="edit-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Haircut, Color, Treatment"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe the service details..."
                />
              </div>
            </div>

            {/* Pricing and Duration Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Pricing and Duration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-duration_minutes" className="text-sm font-medium">
                    Duration (minutes) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-duration_minutes"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    required
                    min="15"
                    step="15"
                    placeholder="60"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-new_customer_price" className="text-sm font-medium">
                    New Customer Price <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-new_customer_price"
                    type="number"
                    step="0.01"
                    value={formData.new_customer_price}
                    onChange={(e) => setFormData({ ...formData, new_customer_price: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-existing_customer_price" className="text-sm font-medium">
                    Existing Customer Price <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-existing_customer_price"
                    type="number"
                    step="0.01"
                    value={formData.existing_customer_price}
                    onChange={(e) => setFormData({ ...formData, existing_customer_price: e.target.value })}
                    required
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Availability and Settings Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Availability and Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-sort_order" className="text-sm font-medium">Sort Order</Label>
                  <Input
                    id="edit-sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-is_active" className="text-sm font-medium">Active</Label>
                    <Switch
                      id="edit-is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-is_existing_customer" className="text-sm font-medium">Available to Existing Customers</Label>
                    <Switch
                      id="edit-is_existing_customer"
                      checked={formData.is_existing_customer}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_existing_customer: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="edit-is_new_customer" className="text-sm font-medium">Available to New Customers</Label>
                    <Switch
                      id="edit-is_new_customer"
                      checked={formData.is_new_customer}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_new_customer: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Service
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
