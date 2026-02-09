'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Bell, 
  Search, 
  Calendar, 
  Clock, 
  User, 
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ListChecks,
  Filter,
  Phone,
  MessageSquare,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { WaitlistRequestWithDetails } from '@/types'

export default function AdminWaitlistPage() {
  const [waitlistRequests, setWaitlistRequests] = useState<WaitlistRequestWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [waitlistEnabled, setWaitlistEnabled] = useState(true)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [waitlistToCancel, setWaitlistToCancel] = useState<WaitlistRequestWithDetails | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Fetch waitlist requests
  const fetchWaitlistRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/waitlist')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch waitlist requests')
      }
      
      const data = await response.json().catch(() => ({}))
      const list = Array.isArray(data?.waitlist) ? data.waitlist : []
      setWaitlistRequests(list)
    } catch (error) {
      console.error('Error fetching waitlist:', error)
      toast.error('Failed to load waitlist requests')
    } finally {
      setLoading(false)
    }
  }

  // Manual availability check
  const handleCheckAvailability = async () => {
    try {
      setCheckingAvailability(true)
      toast.info('Checking for available slots...')
      
      const response = await fetch('/api/cron/check-waitlist-availability', { credentials: 'include' })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const msg = errorData.error || 'Failed to check availability'
        if (response.status === 401) {
          throw new Error('Please log in to the admin panel and try again.')
        }
        throw new Error(msg)
      }
      
      const data = await response.json()
      
      if (data.success) {
        const message = data.detail ?? `Processed ${data.processed} request(s), notified ${data.notified} customer(s).`
        toast.success(message, { duration: (data.noSlotsFound > 0 || data.emailSkipped > 0) ? 8000 : 4000 })
        
        // Refresh the list to show updated statuses
        await fetchWaitlistRequests()
      } else {
        throw new Error(data.error || 'Availability check failed')
      }
    } catch (error) {
      console.error('Error checking availability:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to check availability'
      toast.error(errorMessage)
    } finally {
      setCheckingAvailability(false)
    }
  }

  // Cancel waitlist request
  const handleCancelWaitlist = async (request: WaitlistRequestWithDetails) => {
    setWaitlistToCancel(request)
    setShowCancelConfirm(true)
  }

  const confirmCancelWaitlist = async () => {
    if (!waitlistToCancel) return

    try {
      setCancelling(true)
      
      const response = await fetch('/api/admin/waitlist', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: waitlistToCancel.id,
          action: 'cancel'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to cancel waitlist request')
      }

      toast.success('Waitlist request cancelled successfully')
      
      // Refresh the list to show updated status
      await fetchWaitlistRequests()
      
      // Close confirmation dialog
      setShowCancelConfirm(false)
      setWaitlistToCancel(null)
      
    } catch (error) {
      console.error('Error cancelling waitlist request:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel waitlist request'
      toast.error(errorMessage)
    } finally {
      setCancelling(false)
    }
  }

  useEffect(() => {
    fetchWaitlistRequests()
    markWaitlistAsViewed()
  }, [])

  // Mark waitlist as viewed when page loads
  const markWaitlistAsViewed = async () => {
    try {
      console.log('🔔 [WAITLIST PAGE] Marking waitlist as viewed...')
      const response = await fetch('/api/admin/waitlist/mark-viewed', {
        method: 'POST'
      })
      if (response.ok) {
        const data = await response.json()
        console.log('🔔 [WAITLIST PAGE] Successfully marked as viewed:', data)
      } else {
        const errorData = await response.json()
        console.error('🔔 [WAITLIST PAGE] Failed to mark as viewed:', response.status)
        console.error('🔔 [WAITLIST PAGE] Error details:', errorData)
      }
    } catch (error) {
      console.error('🔔 [WAITLIST PAGE] Error marking waitlist as viewed:', error)
      // Don't show error to user - this is a background operation
    }
  }

  // Fetch waitlist setting
  useEffect(() => {
    const fetchWaitlistSetting = async () => {
      try {
        const response = await fetch('/api/admin/settings')
        if (response.ok) {
          const data = await response.json()
          setWaitlistEnabled(data.waitlist?.enabled !== false) // Default to true if not set
        }
      } catch (error) {
        console.error('Error fetching waitlist setting:', error)
        // Default to enabled if there's an error
        setWaitlistEnabled(true)
      }
    }
    
    fetchWaitlistSetting()
  }, [])

  // Filter waitlist requests
  const filteredRequests = waitlistRequests.filter(request => {
    const matchesSearch = 
      request.customers.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.customers.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.services.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Format date - handle both YYYY-MM-DD and ISO timestamp formats
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    
    // If it's a YYYY-MM-DD format, parse manually to avoid timezone issues
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number)
      const date = new Date(year, month - 1, day) // month is 0-indexed
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    }
    
    // For ISO timestamps, use normal Date parsing
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Invalid Date'
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case 'notified':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Bell className="w-3 h-3 mr-1" />Notified</Badge>
      case 'converted':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Converted</Badge>
      case 'expired':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200"><AlertCircle className="w-3 h-3 mr-1" />Expired</Badge>
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Stats
  const stats = {
    total: waitlistRequests.length,
    pending: waitlistRequests.filter(r => r.status === 'pending').length,
    notified: waitlistRequests.filter(r => r.status === 'notified').length,
    converted: waitlistRequests.filter(r => r.status === 'converted').length,
    expired: waitlistRequests.filter(r => r.status === 'expired').length,
    cancelled: waitlistRequests.filter(r => r.status === 'cancelled').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading waitlist...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Waitlist Management</h1>
          <p className="text-sm sm:text-base text-gray-600">
            View and manage customer waitlist requests for appointments
          </p>
        </div>
        <Button 
          onClick={handleCheckAvailability}
          disabled={checkingAvailability}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          {checkingAvailability ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <Bell className="w-4 h-4" />
              Check Availability Now
            </>
          )}
        </Button>
      </div>

      {/* Warning when waitlist is disabled */}
      {!waitlistEnabled && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-start">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 mr-3 mt-0.5 shrink-0" />
              <div className="text-xs sm:text-sm text-red-900">
                <p className="font-medium mb-1">Waitlist is currently disabled</p>
                <p className="text-red-800">
                  The waitlist feature is turned off in your settings. Customers cannot join the waitlist, and no new waitlist requests will be created. 
                  You can enable it again in <strong>Settings → Schedule → Waitlist Settings</strong>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
        {/* Total Requests */}
        <Card className="border-0 shadow-sm bg-linear-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{stats.total}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 md:h-6 md:w-6 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                  <ListChecks className="h-3 w-3 md:h-4 md:w-4 text-gray-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs md:text-sm text-gray-600">Total Requests</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="border-0 shadow-sm bg-linear-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl md:text-3xl font-bold text-yellow-600 mb-2">{stats.pending}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 md:h-6 md:w-6 bg-yellow-50 rounded-lg flex items-center justify-center border border-yellow-200">
                  <Clock className="h-3 w-3 md:h-4 md:w-4 text-yellow-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs md:text-sm text-gray-600">Pending</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notified */}
        <Card className="border-0 shadow-sm bg-linear-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl md:text-3xl font-bold text-blue-600 mb-2">{stats.notified}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 md:h-6 md:w-6 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-200">
                  <Bell className="h-3 w-3 md:h-4 md:w-4 text-blue-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs md:text-sm text-gray-600">Notified</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Converted */}
        <Card className="border-0 shadow-sm bg-linear-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl md:text-3xl font-bold text-green-600 mb-2">{stats.converted}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 md:h-6 md:w-6 bg-green-50 rounded-lg flex items-center justify-center border border-green-200">
                  <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs md:text-sm text-gray-600">Converted</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expired */}
        <Card className="border-0 shadow-sm bg-linear-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl md:text-3xl font-bold text-gray-600 mb-2">{stats.expired}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 md:h-6 md:w-6 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                  <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-gray-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs md:text-sm text-gray-600">Expired</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cancelled */}
        <Card className="border-0 shadow-sm bg-linear-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="text-2xl md:text-3xl font-bold text-red-600 mb-2">{stats.cancelled}</div>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 md:h-6 md:w-6 bg-red-50 rounded-lg flex items-center justify-center border border-red-200">
                  <XCircle className="h-3 w-3 md:h-4 md:w-4 text-red-600" strokeWidth={1.5} />
                </div>
                <div className="text-xs md:text-sm text-gray-600">Cancelled</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by customer name, email, or service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm sm:text-base"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500 shrink-0" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-36 md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="notified">Notified</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Waitlist Table */}
      <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-0">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8 sm:py-12 px-6">
              <Bell className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-base sm:text-lg mb-2">No waitlist requests found</p>
              <p className="text-gray-400 text-sm">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your filters' 
                  : 'Customers can join the waitlist when booking'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Layout */}
              <div className="block lg:hidden space-y-3 p-4 sm:p-6">
                {filteredRequests.map((request) => (
                  <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2">
                        <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 text-sm">{request.customers.name}</div>
                          <div className="text-xs text-gray-500 flex items-center mt-0.5">
                            <Mail className="w-3 h-3 mr-1 shrink-0" />
                            <span className="truncate">{request.customers.email}</span>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-gray-500">Service</div>
                        <div className="font-medium text-gray-900">{request.services.name}</div>
                        <div className="text-gray-500">{request.services.duration_minutes} min</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Date Range</div>
                        <div className="font-medium text-gray-900">{formatDate(request.start_date)}</div>
                        <div className="font-medium text-gray-900">to {formatDate(request.end_date)}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-gray-500">Created</div>
                        <div className="text-gray-900">{formatDate(request.created_at)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Notified</div>
                        <div className="text-gray-900">
                          {request.notified_at ? formatDate(request.notified_at) : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Contact Buttons */}
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`sms:${request.customers.phone}`, '_self')
                        }}
                        title={`Text ${request.customers.name}`}
                      >
                        <MessageSquare className="w-3 h-3 mr-1.5" />
                        Text
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          window.open(`tel:${request.customers.phone}`, '_self')
                        }}
                        title={`Call ${request.customers.name}`}
                      >
                        <Phone className="w-3 h-3 mr-1.5" />
                        Call
                      </Button>
                      <a
                        href={`mailto:${request.customers.email}`}
                        className="flex-1 h-8 text-xs inline-flex items-center justify-center border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                        onClick={(e) => e.stopPropagation()}
                        title={`Email ${request.customers.name}`}
                      >
                        <Mail className="w-3 h-3 mr-1.5" />
                        Email
                      </a>
                    </div>

                    {/* Cancel Button - Only show for pending and notified statuses */}
                    {(request.status === 'pending' || request.status === 'notified') && (
                      <div>
                        <Button 
                          variant="destructive" 
                          size="sm"
                          className="w-full h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleCancelWaitlist(request)
                          }}
                          title={`Cancel waitlist request for ${request.customers.name}`}
                        >
                          <Trash2 className="w-3 h-3 mr-1.5" />
                          Cancel Request
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Layout */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notified</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-start">
                            <User className="w-4 h-4 text-gray-400 mr-2 mt-0.5 shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{request.customers.name}</div>
                              <div className="text-xs text-gray-500 flex items-center mt-0.5">
                                <Mail className="w-3 h-3 mr-1" />
                                {request.customers.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{request.services.name}</div>
                          <div className="text-xs text-gray-500">{request.services.duration_minutes} min</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-start">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2 mt-0.5 shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{formatDate(request.start_date)}</div>
                              <div className="text-xs text-gray-500">to {formatDate(request.end_date)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(request.created_at)}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {request.notified_at ? formatDate(request.notified_at) : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(`sms:${request.customers.phone}`, '_self')
                              }}
                              title={`Text ${request.customers.name}`}
                            >
                              <MessageSquare className="w-3 h-3" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(`tel:${request.customers.phone}`, '_self')
                              }}
                              title={`Call ${request.customers.name}`}
                            >
                              <Phone className="w-3 h-3" />
                            </Button>
                            <a
                              href={`mailto:${request.customers.email}`}
                              className="h-7 px-2 text-xs inline-flex items-center justify-center border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                              onClick={(e) => e.stopPropagation()}
                              title={`Email ${request.customers.name}`}
                            >
                              <Mail className="w-3 h-3" />
                            </a>
                            {/* Cancel Button - Only show for pending and notified statuses */}
                            {(request.status === 'pending' || request.status === 'notified') && (
                              <Button 
                                variant="destructive" 
                                size="sm"
                                className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCancelWaitlist(request)
                                }}
                                title={`Cancel waitlist request for ${request.customers.name}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
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

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-start">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mr-3 mt-0.5 shrink-0" />
            <div className="text-xs sm:text-sm text-blue-900">
              <p className="font-medium mb-1">How the waitlist works:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Customers can join the waitlist when no appointments are available</li>
                <li>When you cancel or reschedule a booking, customers on the waitlist are automatically notified</li>
                <li>Notifications are sent via email with a link to book the available slot</li>
                <li>Customers can manage their waitlist entries from their account</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && waitlistToCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Cancel Waitlist Request</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-2">
                Are you sure you want to cancel the waitlist request for:
              </p>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900">{waitlistToCancel.customers.name}</p>
                <p className="text-sm text-gray-600">{waitlistToCancel.customers.email}</p>
                <p className="text-sm text-gray-600">{waitlistToCancel.services.name}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelConfirm(false)
                  setWaitlistToCancel(null)
                }}
                disabled={cancelling}
              >
                Keep Request
              </Button>
              <Button
                variant="destructive"
                onClick={confirmCancelWaitlist}
                disabled={cancelling}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Cancel Request
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

