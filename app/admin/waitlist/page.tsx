'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  MessageSquare
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

  // Fetch waitlist requests
  const fetchWaitlistRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/waitlist')
      
      if (!response.ok) {
        throw new Error('Failed to fetch waitlist requests')
      }
      
      const data = await response.json()
      setWaitlistRequests(data.waitlist || [])
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
      
      const response = await fetch('/api/cron/check-waitlist-availability')
      
      if (!response.ok) {
        throw new Error('Failed to check availability')
      }
      
      const data = await response.json()
      
      if (data.success) {
        toast.success(
          `Availability check complete! Processed ${data.processed} request(s), notified ${data.notified} customer(s).`
        )
        
        // Refresh the list to show updated statuses
        await fetchWaitlistRequests()
      } else {
        throw new Error('Availability check failed')
      }
    } catch (error) {
      console.error('Error checking availability:', error)
      toast.error('Failed to check availability')
    } finally {
      setCheckingAvailability(false)
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
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
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
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
        {/* Total Requests */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-xs md:text-sm text-gray-600 mt-1">Total Requests</div>
              </div>
              <div className="h-6 w-6 md:h-8 md:w-8 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                <ListChecks className="h-3 w-3 md:h-4 md:w-4 text-gray-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-xs md:text-sm text-gray-600 mt-1">Pending</div>
              </div>
              <div className="h-6 w-6 md:h-8 md:w-8 bg-yellow-50 rounded-lg flex items-center justify-center border border-yellow-200">
                <Clock className="h-3 w-3 md:h-4 md:w-4 text-yellow-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notified */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-blue-600">{stats.notified}</div>
                <div className="text-xs md:text-sm text-gray-600 mt-1">Notified</div>
              </div>
              <div className="h-6 w-6 md:h-8 md:w-8 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-200">
                <Bell className="h-3 w-3 md:h-4 md:w-4 text-blue-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Converted */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-green-600">{stats.converted}</div>
                <div className="text-xs md:text-sm text-gray-600 mt-1">Converted</div>
              </div>
              <div className="h-6 w-6 md:h-8 md:w-8 bg-green-50 rounded-lg flex items-center justify-center border border-green-200">
                <CheckCircle className="h-3 w-3 md:h-4 md:w-4 text-green-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expired */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-gray-600">{stats.expired}</div>
                <div className="text-xs md:text-sm text-gray-600 mt-1">Expired</div>
              </div>
              <div className="h-6 w-6 md:h-8 md:w-8 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-gray-600" strokeWidth={1.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cancelled */}
        <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-red-600">{stats.cancelled}</div>
                <div className="text-xs md:text-sm text-gray-600 mt-1">Cancelled</div>
              </div>
              <div className="h-6 w-6 md:h-8 md:w-8 bg-red-50 rounded-lg flex items-center justify-center border border-red-200">
                <XCircle className="h-3 w-3 md:h-4 md:w-4 text-red-600" strokeWidth={1.5} />
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
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
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
              {/* Mobile Layout */}
              <div className="block md:hidden space-y-3 p-6">
                {filteredRequests.map((request) => (
                  <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2">
                        <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 text-sm">{request.customers.name}</div>
                          <div className="text-xs text-gray-500 flex items-center mt-0.5">
                            <Mail className="w-3 h-3 mr-1 flex-shrink-0" />
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
                        <div className="text-gray-500">to {formatDate(request.end_date)}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t">
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
                    <div className="flex gap-2 pt-2 border-t">
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
                  </div>
                ))}
              </div>

              {/* Tablet Layout */}
              <div className="hidden md:block lg:hidden overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{request.customers.name}</div>
                            <div className="text-xs text-gray-500 flex items-center mt-0.5">
                              <Mail className="w-3 h-3 mr-1" />
                              {request.customers.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{request.services.name}</div>
                          <div className="text-xs text-gray-500">{request.services.duration_minutes} min</div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(request.start_date)}</div>
                          <div className="text-xs text-gray-500">to {formatDate(request.end_date)}</div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(request.created_at)}</div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
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
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                            <User className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
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
                            <Calendar className="w-4 h-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
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
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
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
    </div>
  )
}

