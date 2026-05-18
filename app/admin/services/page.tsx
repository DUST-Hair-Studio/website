'use client'

import { useState, useEffect } from 'react'
import { Service } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Eye, EyeOff, Loader2, Clock } from 'lucide-react'

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
            <Button variant="primary" onClick={openCreateDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Service</DialogTitle>
              <DialogDescription>
                Add a new service with dual pricing for new and loyalty customers.
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
                      Loyalty Customer Price <span className="text-red-500">*</span>
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
                      <Label htmlFor="is_existing_customer" className="text-sm font-medium">Available to Loyalty Customers</Label>
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
                <Button variant="primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Service
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Services List */}
      <div className="grid gap-3">
        {services.filter(service => service.is_active).map((service) => (
          <ServiceRow
            key={service.id}
            service={service}
            onToggle={toggleServiceStatus}
            onEdit={openEditDialog}
            onDelete={handleDelete}
            formatPrice={formatPrice}
            formatDuration={formatDuration}
          />
        ))}
      </div>

      {/* Inactive Services Section */}
      {services.filter(service => !service.is_active).length > 0 && (
        <div className="mt-12">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Inactive Services</h2>
            <p className="text-gray-600 mt-2">Services that are currently disabled and not visible to customers</p>
          </div>
          
          <div className="grid gap-3">
            {services.filter(service => !service.is_active).map((service) => (
              <ServiceRow
                key={service.id}
                service={service}
                onToggle={toggleServiceStatus}
                onEdit={openEditDialog}
                onDelete={handleDelete}
                formatPrice={formatPrice}
                formatDuration={formatDuration}
              />
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
                    Loyalty Customer Price <span className="text-red-500">*</span>
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
                    <Label htmlFor="edit-is_existing_customer" className="text-sm font-medium">Available to Loyalty Customers</Label>
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
              <Button variant="primary" type="submit" disabled={isSubmitting}>
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

interface ServiceRowProps {
  service: Service
  onToggle: (service: Service) => void
  onEdit: (service: Service) => void
  onDelete: (serviceId: string) => void
  formatPrice: (cents: number) => string
  formatDuration: (minutes: number) => string
}

function ServiceRow({ service, onToggle, onEdit, onDelete, formatPrice, formatDuration }: ServiceRowProps) {
  const isInactive = !service.is_active
  return (
    <div
      className={`group rounded-lg border bg-white px-4 py-3 transition-shadow hover:shadow-sm ${
        isInactive ? 'border-gray-200 opacity-70' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{service.name}</h3>
            {service.category && (
              <Badge variant="secondary" className="text-xs font-normal">
                {service.category}
              </Badge>
            )}
            {isInactive && (
              <Badge variant="secondary" className="bg-gray-100 text-xs text-gray-600">
                Inactive
              </Badge>
            )}
          </div>
          {service.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{service.description}</p>
          )}
        </div>

        <div className="hidden items-center gap-5 text-sm sm:flex">
          <div className="flex items-center gap-1 text-gray-600">
            <Clock className="h-3.5 w-3.5" />
            <span className="tabular-nums">{formatDuration(service.duration_minutes)}</span>
          </div>
          <div className="flex items-center gap-3 tabular-nums">
            <span
              className={
                service.is_new_customer
                  ? 'font-semibold text-green-600'
                  : 'text-gray-400 line-through'
              }
              title={service.is_new_customer ? 'New customer price' : 'Not available to new customers'}
            >
              {formatPrice(service.new_customer_price)}
              <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-gray-500">New</span>
            </span>
            <span
              className={
                service.is_existing_customer
                  ? 'font-semibold text-indigo-600'
                  : 'text-gray-400 line-through'
              }
              title={service.is_existing_customer ? 'Loyalty customer price' : 'Not available to loyalty customers'}
            >
              {formatPrice(service.existing_customer_price)}
              <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-gray-500">Loyal</span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onToggle(service)}
            title={service.is_active ? 'Deactivate' : 'Activate'}
          >
            {service.is_active ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(service)}
            title="Edit"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Service</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{service.name}&quot;? This action cannot be undone.
                  {service.is_active && (
                    <span className="mt-2 block text-yellow-600">
                      ⚠️ This service is currently active and visible to customers.
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(service.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Service
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Mobile stats row */}
      <div className="mt-2 flex items-center gap-4 text-xs text-gray-600 sm:hidden">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDuration(service.duration_minutes)}
        </span>
        <span
          className={
            service.is_new_customer
              ? 'font-semibold text-green-600'
              : 'text-gray-400 line-through'
          }
        >
          {formatPrice(service.new_customer_price)} New
        </span>
        <span
          className={
            service.is_existing_customer
              ? 'font-semibold text-indigo-600'
              : 'text-gray-400 line-through'
          }
        >
          {formatPrice(service.existing_customer_price)} Loyal
        </span>
      </div>
    </div>
  )
}
