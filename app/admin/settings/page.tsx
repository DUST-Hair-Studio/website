"use client"

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Loader2, Calendar, Clock, Link, Unlink, CheckCircle, XCircle, CreditCard, Building, ListChecks, UserPlus, Users, Mail } from 'lucide-react'
import { toast } from 'sonner'

interface BusinessHours {
  day_of_week: number
  day_name: string
  is_open: boolean
  open_time: string
  close_time: string
  timezone: string
}

interface GoogleCalendarStatus {
  isConnected: boolean
  calendarId?: string
  hasToken: boolean
  authUrl?: string
}

interface BusinessSettings {
  business_name: string
  business_phone: string
  business_email: string
  business_address: string
  timezone: string
}


interface PaymentSettings {
  square_enabled: boolean
  square_application_id: string
  square_access_token: string
  square_environment: string
  square_location_id: string
}

interface SavedCredentialInfo {
  application_id_prefix: string
  access_token_prefix: string
  access_token_length: number
  has_application_id: boolean
  has_access_token: boolean
}

interface ScheduleSettings {
  buffer_time_minutes: number
  booking_available_from_date: string | null
}

interface WaitlistSettings {
  enabled: boolean
}

interface AdminUser {
  id: string
  email: string
  name: string
  is_active: boolean
  last_login?: string
  created_at: string
}

const DAYS = [
  { value: 0, name: 'Sunday' },
  { value: 1, name: 'Monday' },
  { value: 2, name: 'Tuesday' },
  { value: 3, name: 'Wednesday' },
  { value: 4, name: 'Thursday' },
  { value: 5, name: 'Friday' },
  { value: 6, name: 'Saturday' }
]

const TIMEZONES = [
  'America/Los_Angeles',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'Europe/London',
  'Europe/Paris',
  'Australia/Sydney'
]

function AdminSettingsContent() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('business')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [disconnectDialog, setDisconnectDialog] = useState<{
    open: boolean
    type: 'google-calendar' | 'square-payments' | null
    title: string
    description: string
  }>({
    open: false,
    type: null,
    title: '',
    description: ''
  })
  
  // Business Hours State
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([])
  
  // Google Calendar State
  const [googleCalendar, setGoogleCalendar] = useState<GoogleCalendarStatus>({
    isConnected: false,
    hasToken: false
  })
  
  // Business Settings State
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    business_name: '',
    business_phone: '',
    business_email: '',
    business_address: '',
    timezone: 'America/Los_Angeles'
  })
  
  
  // Payment Settings State
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    square_enabled: false,
    square_application_id: '',
    square_access_token: '',
    square_environment: 'production',
    square_location_id: ''
  })
  
  // Track saved credential info for display
  const [savedCredentials, setSavedCredentials] = useState<SavedCredentialInfo>({
    application_id_prefix: '',
    access_token_prefix: '',
    access_token_length: 0,
    has_application_id: false,
    has_access_token: false
  })
  
  // Show/hide credential fields
  const [showAppId, setShowAppId] = useState(false)
  const [showAccessToken, setShowAccessToken] = useState(false)
  
  // Schedule Settings State
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>({
    buffer_time_minutes: 0,
    booking_available_from_date: null
  })
  
  // Waitlist Settings State
  const [waitlistSettings, setWaitlistSettings] = useState<WaitlistSettings>({
    enabled: true
  })

  // Admin Users State
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)

  // Initialize business hours with default values
  useEffect(() => {
    const defaultHours: BusinessHours[] = DAYS.map(day => ({
      day_of_week: day.value,
      day_name: day.name,
      is_open: [5, 6, 0].includes(day.value), // Friday, Saturday, Sunday
      open_time: '11:00',
      close_time: '21:00',
      timezone: 'America/Los_Angeles'
    }))
    setBusinessHours(defaultHours)
  }, [])

  // Fetch all settings
  const fetchSettings = async () => {
    try {
      setLoading(true)
      
      // Fetch business hours
      const hoursResponse = await fetch('/api/admin/business-hours')
      if (hoursResponse.ok) {
        const hoursData = await hoursResponse.json()
        if (hoursData.businessHours && hoursData.businessHours.length > 0) {
          setBusinessHours(hoursData.businessHours)
        }
      }

      // Fetch Google Calendar status
      const googleResponse = await fetch('/api/admin/google-calendar')
      if (googleResponse.ok) {
        const googleData = await googleResponse.json()
        setGoogleCalendar(googleData)
      }

      // Fetch general settings
      const settingsResponse = await fetch('/api/admin/settings')
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json()
        setBusinessSettings(prev => ({ ...prev, ...settingsData.business }))
        setPaymentSettings(prev => ({ ...prev, ...settingsData.payments }))
        setScheduleSettings(prev => ({ ...prev, ...settingsData.schedule }))
        setWaitlistSettings(prev => ({ ...prev, ...settingsData.waitlist }))
      }
      
      // Fetch saved credential info for display
      try {
        const configResponse = await fetch('/api/debug/test-square-config')
        if (configResponse.ok) {
          const configData = await configResponse.json()
          setSavedCredentials({
            application_id_prefix: configData.application_id_prefix || '',
            access_token_prefix: configData.access_token_prefix || '',
            access_token_length: configData.access_token_length || 0,
            has_application_id: configData.has_application_id || false,
            has_access_token: configData.has_access_token || false
          })
        }
      } catch (e) {
        console.error('Failed to fetch credential info:', e)
      }

      // Fetch admin users
      try {
        const adminsResponse = await fetch('/api/admin/admins')
        if (adminsResponse.ok) {
          const adminsData = await adminsResponse.json()
          setAdmins(adminsData.admins || [])
        }
      } catch (e) {
        console.error('Failed to fetch admins:', e)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleInviteAdmin = async () => {
    const email = inviteEmail.trim()
    if (!email) {
      toast.error('Please enter an email address')
      return
    }
    try {
      setInviting(true)
      const response = await fetch('/api/admin/invite-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: inviteName.trim() || undefined })
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invite')
      }
      toast.success(data.message || 'Invite sent successfully')
      setInviteEmail('')
      setInviteName('')
      fetchSettings() // Refresh admin list
    } catch (error) {
      console.error('Invite admin error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    
    // Check for tab parameter in URL
    const tab = searchParams.get('tab')
    if (tab && ['business', 'schedule', 'payments', 'integrations', 'admins'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  // Save business hours
  const saveBusinessHours = async () => {
    try {
      setSaving(true)
      
      // Save business hours
      const hoursResponse = await fetch('/api/admin/business-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessHours })
      })

      if (!hoursResponse.ok) {
        throw new Error('Failed to save business hours')
      }
      
      // Save schedule settings
      const settingsResponse = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          schedule: scheduleSettings 
        })
      })

      if (!settingsResponse.ok) {
        throw new Error('Failed to save schedule settings')
      }
      
      // Save waitlist settings
      const waitlistResponse = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          waitlist: waitlistSettings 
        })
      })

      if (!waitlistResponse.ok) {
        throw new Error('Failed to save waitlist settings')
      }

      toast.success('Schedule settings saved successfully')
    } catch (error) {
      console.error('Error saving schedule settings:', error)
      toast.error('Failed to save schedule settings')
    } finally {
      setSaving(false)
    }
  }

  // Save business settings
  const saveBusinessSettings = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'business',
          settings: businessSettings 
        })
      })

      if (response.ok) {
        toast.success('Business settings saved successfully')
      } else {
        throw new Error('Failed to save business settings')
      }
    } catch (error) {
      console.error('Error saving business settings:', error)
      toast.error('Failed to save business settings')
    } finally {
      setSaving(false)
    }
  }


  // Save payment settings
  const savePaymentSettings = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'payments',
          settings: paymentSettings 
        })
      })

      if (response.ok) {
        toast.success('Payment settings saved successfully')
      } else {
        throw new Error('Failed to save payment settings')
      }
    } catch (error) {
      console.error('Error saving payment settings:', error)
      toast.error('Failed to save payment settings')
    } finally {
      setSaving(false)
    }
  }

  // Handle Google Calendar OAuth
  const handleGoogleCalendarAuth = () => {
    if (googleCalendar.authUrl) {
      window.location.href = googleCalendar.authUrl
    }
  }

  const handleGoogleCalendarDisconnect = () => {
    setDisconnectDialog({
      open: true,
      type: 'google-calendar',
      title: 'Disconnect Google Calendar',
      description: 'Are you sure you want to disconnect Google Calendar? This will stop syncing bookings and calendar events. You can reconnect at any time.'
    })
  }

  const handleSquarePaymentToggle = (checked: boolean) => {
    if (!checked && paymentSettings.square_enabled) {
      // Show confirmation dialog when disabling Square payments
      setDisconnectDialog({
        open: true,
        type: 'square-payments',
        title: 'Disable Square Payments',
        description: 'Are you sure you want to disable Square payment processing? This will prevent customers from making payments through Square. All existing payment links will stop working. You can re-enable it at any time.'
      })
    } else {
      // Directly enable or if it's already disabled
      setPaymentSettings(prev => ({ ...prev, square_enabled: checked }))
    }
  }

  const confirmDisconnect = async () => {
    try {
      if (disconnectDialog.type === 'google-calendar') {
        const response = await fetch('/api/admin/google-calendar', {
          method: 'DELETE'
        })
        
        if (response.ok) {
          setGoogleCalendar({ isConnected: false, hasToken: false })
          toast.success('Google Calendar disconnected successfully')
        } else {
          throw new Error('Failed to disconnect Google Calendar')
        }
      } else if (disconnectDialog.type === 'square-payments') {
        // Disable Square payments
        setPaymentSettings(prev => ({ ...prev, square_enabled: false }))
        toast.success('Square payments disabled successfully')
      }
      
      // Close dialog
      setDisconnectDialog({
        open: false,
        type: null,
        title: '',
        description: ''
      })
    } catch (error) {
      console.error('Error disconnecting integration:', error)
      toast.error('Failed to disconnect integration')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage your business settings and integrations</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-6 h-auto p-1">
          <TabsTrigger value="business" className="flex items-center justify-center gap-2 text-sm py-3 px-2 data-[state=active]:bg-black data-[state=active]:text-white">
            <Building className="hidden sm:block h-4 w-4" />
            <span className="hidden sm:inline">Business</span>
            <span className="sm:hidden">Business</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center justify-center gap-2 text-sm py-3 px-2 data-[state=active]:bg-black data-[state=active]:text-white">
            <Clock className="hidden sm:block h-4 w-4" />
            <span className="hidden sm:inline">Schedule</span>
            <span className="sm:hidden">Schedule</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center justify-center gap-2 text-sm py-3 px-2 data-[state=active]:bg-black data-[state=active]:text-white">
            <CreditCard className="hidden sm:block h-4 w-4" />
            <span className="hidden sm:inline">Payments</span>
            <span className="sm:hidden">Payments</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center justify-center gap-2 text-sm py-3 px-2 data-[state=active]:bg-black data-[state=active]:text-white">
            <Link className="hidden sm:block h-4 w-4" />
            <span className="hidden sm:inline">Integrations</span>
            <span className="sm:hidden">Apps</span>
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex items-center justify-center gap-2 text-sm py-3 px-2 data-[state=active]:bg-black data-[state=active]:text-white">
            <Users className="hidden sm:block h-4 w-4" />
            <span className="hidden sm:inline">Admins</span>
            <span className="sm:hidden">Admins</span>
          </TabsTrigger>
        </TabsList>

        {/* Business Settings Tab */}
        <TabsContent value="business" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="business_name">Business Name</Label>
                  <Input
                    id="business_name"
                    value={businessSettings.business_name}
                    onChange={(e) => setBusinessSettings(prev => ({ ...prev, business_name: e.target.value }))}
                    placeholder="DUST Studio"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_phone">Phone Number</Label>
                  <Input
                    id="business_phone"
                    value={businessSettings.business_phone}
                    onChange={(e) => setBusinessSettings(prev => ({ ...prev, business_phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business_email">Email</Label>
                  <Input
                    id="business_email"
                    type="email"
                    value={businessSettings.business_email}
                    onChange={(e) => setBusinessSettings(prev => ({ ...prev, business_email: e.target.value }))}
                    placeholder="info@dustsalon.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={businessSettings.timezone}
                    onValueChange={(value) => setBusinessSettings(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_address">Business Address</Label>
                <Textarea
                  id="business_address"
                  value={businessSettings.business_address}
                  onChange={(e) => setBusinessSettings(prev => ({ ...prev, business_address: e.target.value }))}
                  placeholder="123 Main St, City, State 12345"
                  rows={3}
                />
              </div>
              <Button onClick={saveBusinessSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Business Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Settings Tab */}
        <TabsContent value="schedule" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Business Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
              <div className="space-y-4">
                {businessHours.map((day) => (
                  <div key={day.day_of_week} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Switch
                          checked={day.is_open}
                          onCheckedChange={(checked) => {
                            const updated = businessHours.map(d => 
                              d.day_of_week === day.day_of_week 
                                ? { ...d, is_open: checked }
                                : d
                            )
                            setBusinessHours(updated)
                          }}
                        />
                        <Label className="text-sm font-medium">{day.day_name}</Label>
                      </div>
                    </div>
                    {day.is_open && (
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                        <div className="flex items-center space-x-2">
                          <Input
                            type="time"
                            value={day.open_time}
                            onChange={(e) => {
                              const updated = businessHours.map(d => 
                                d.day_of_week === day.day_of_week 
                                  ? { ...d, open_time: e.target.value }
                                  : d
                              )
                              setBusinessHours(updated)
                            }}
                            className="w-full sm:w-32"
                          />
                          <span className="text-sm text-gray-500">to</span>
                          <Input
                            type="time"
                            value={day.close_time}
                            onChange={(e) => {
                              const updated = businessHours.map(d => 
                                d.day_of_week === day.day_of_week 
                                  ? { ...d, close_time: e.target.value }
                                  : d
                              )
                              setBusinessHours(updated)
                            }}
                            className="w-full sm:w-32"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <Button onClick={saveBusinessHours} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Business Hours
              </Button>
            </CardContent>
          </Card>

          {/* Booking Start Date */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Booking Start Date
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="booking_available_from_date">First date customers can book</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Leave empty to allow booking from today. Set a date (e.g. 3/1) to open booking only from that day onward.
                  </p>
                </div>
                <Input
                  id="booking_available_from_date"
                  type="date"
                  value={scheduleSettings.booking_available_from_date || ''}
                  onChange={(e) => setScheduleSettings(prev => ({ 
                    ...prev, 
                    booking_available_from_date: e.target.value || null 
                  }))}
                  className="w-full sm:w-48"
                />
              </div>
              
              <Button onClick={saveBusinessHours} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Booking Start Date
              </Button>
            </CardContent>
          </Card>

          {/* Buffer Time Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Buffer Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="buffer_time">Buffer Time (minutes)</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    Extra time added between appointments to allow for cleanup and preparation
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    id="buffer_time"
                    type="number"
                    min="0"
                    max="60"
                    value={scheduleSettings.buffer_time_minutes}
                    onChange={(e) => setScheduleSettings(prev => ({ 
                      ...prev, 
                      buffer_time_minutes: parseInt(e.target.value) || 0 
                    }))}
                    className="w-24 sm:w-32"
                  />
                  <span className="text-sm text-gray-500">minutes</span>
                </div>
              </div>
              
              <Button onClick={saveBusinessHours} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Buffer Time
              </Button>
            </CardContent>
          </Card>

          {/* Waitlist Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Waitlist Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="waitlist_enabled">Enable Waitlist</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Allow customers to join a waitlist when no appointments are available
                    </p>
                  </div>
                  <Switch
                    id="waitlist_enabled"
                    checked={waitlistSettings.enabled}
                    onCheckedChange={(checked) => 
                      setWaitlistSettings(prev => ({ ...prev, enabled: checked }))
                    }
                  />
                </div>
              </div>
              
              <Button onClick={saveBusinessHours} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Waitlist Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="square_enabled">Square Payment Processing</Label>
                    <p className="text-sm text-gray-600">Enable Square payment processing</p>
                  </div>
                  <Switch
                    id="square_enabled"
                    checked={paymentSettings.square_enabled}
                    onCheckedChange={handleSquarePaymentToggle}
                  />
                </div>
                {paymentSettings.square_enabled && (
                  <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <div className="space-y-2">
                      <Label htmlFor="square_environment">Square Environment</Label>
                      <Select
                        value={paymentSettings.square_environment}
                        onValueChange={(value) => setPaymentSettings(prev => ({ ...prev, square_environment: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                          <SelectItem value="production">Production (Live)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-gray-600">
                        Use Sandbox for testing, Production for live payments
                      </p>
                    </div>
                    
                    {/* Square Application ID */}
                    <div className="space-y-2">
                      <Label htmlFor="square_application_id">Square Application ID</Label>
                      {savedCredentials.has_application_id && (
                        <div className="flex flex-wrap items-center gap-2 p-2 bg-white border rounded text-sm">
                          <span className="text-gray-500">Currently saved:</span>
                          <code className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {savedCredentials.application_id_prefix}
                          </code>
                          {savedCredentials.application_id_prefix.startsWith('sq0idp-') ? (
                            <span className="text-green-600 text-xs font-medium">✓ Production format</span>
                          ) : savedCredentials.application_id_prefix.startsWith('sandbox-') ? (
                            <span className="text-yellow-600 text-xs font-medium">⚠ Sandbox format</span>
                          ) : (
                            <span className="text-red-600 text-xs font-medium">⚠ Unknown format</span>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          id="square_application_id"
                          type="password"
                          value={paymentSettings.square_application_id}
                          onChange={(e) => setPaymentSettings(prev => ({ ...prev, square_application_id: e.target.value }))}
                          placeholder={savedCredentials.has_application_id ? "Enter new ID to replace..." : "sq0idp-..."}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAppId(!showAppId)}
                          className="px-3"
                        >
                          {showAppId ? 'Hide' : 'Verify'}
                        </Button>
                      </div>
                      {showAppId && paymentSettings.square_application_id && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                          <span className="text-gray-600">Preview: </span>
                          <code className="font-mono">
                            {paymentSettings.square_application_id.length > 20 
                              ? `${paymentSettings.square_application_id.substring(0, 12)}...${paymentSettings.square_application_id.slice(-4)}`
                              : paymentSettings.square_application_id.substring(0, 12) + '...'}
                          </code>
                          <span className="text-gray-500 ml-2">({paymentSettings.square_application_id.length} chars)</span>
                        </div>
                      )}
                      {paymentSettings.square_application_id && (
                        <p className="text-sm">
                          {paymentSettings.square_application_id.startsWith('sq0idp-') ? (
                            <span className="text-green-600">✓ Production format detected</span>
                          ) : paymentSettings.square_application_id.startsWith('sandbox-') ? (
                            <span className="text-yellow-600">⚠ Sandbox format - use for testing only</span>
                          ) : (
                            <span className="text-red-600">⚠ Unrecognized format - check your Square Dashboard</span>
                          )}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Production IDs start with <code className="bg-gray-100 px-1 rounded">sq0idp-</code>, 
                        Sandbox IDs start with <code className="bg-gray-100 px-1 rounded">sandbox-sq0idb-</code>
                      </p>
                    </div>
                    
                    {/* Square Access Token */}
                    <div className="space-y-2">
                      <Label htmlFor="square_access_token">Square Access Token</Label>
                      {savedCredentials.has_access_token && (
                        <div className="flex flex-wrap items-center gap-2 p-2 bg-white border rounded text-sm">
                          <span className="text-gray-500">Currently saved:</span>
                          <code className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {savedCredentials.access_token_prefix}
                          </code>
                          <span className="text-gray-400">({savedCredentials.access_token_length} chars)</span>
                          {savedCredentials.access_token_prefix.startsWith('EAAA') ? (
                            <span className="text-green-600 text-xs font-medium">✓ Valid format</span>
                          ) : (
                            <span className="text-red-600 text-xs font-medium">⚠ Check format</span>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Input
                          id="square_access_token"
                          type="password"
                          value={paymentSettings.square_access_token}
                          onChange={(e) => setPaymentSettings(prev => ({ ...prev, square_access_token: e.target.value }))}
                          placeholder={savedCredentials.has_access_token ? "Enter new token to replace..." : "EAAA..."}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAccessToken(!showAccessToken)}
                          className="px-3"
                        >
                          {showAccessToken ? 'Hide' : 'Verify'}
                        </Button>
                      </div>
                      {showAccessToken && paymentSettings.square_access_token && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                          <span className="text-gray-600">Preview: </span>
                          <code className="font-mono">
                            {paymentSettings.square_access_token.length > 16 
                              ? `${paymentSettings.square_access_token.substring(0, 8)}...${paymentSettings.square_access_token.slice(-4)}`
                              : paymentSettings.square_access_token.substring(0, 8) + '...'}
                          </code>
                          <span className="text-gray-500 ml-2">({paymentSettings.square_access_token.length} chars)</span>
                        </div>
                      )}
                      {paymentSettings.square_access_token && (
                        <p className="text-sm">
                          {paymentSettings.square_access_token.startsWith('EAAA') ? (
                            <span className="text-green-600">✓ Valid token format ({paymentSettings.square_access_token.length} chars)</span>
                          ) : (
                            <span className="text-red-600">⚠ Token should start with EAAA</span>
                          )}
                        </p>
                      )}
                    </div>
                    
                    {/* Environment mismatch warning */}
                    {paymentSettings.square_environment === 'production' && savedCredentials.application_id_prefix.startsWith('sandbox-') && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 text-sm font-medium">
                          ⚠️ Environment Mismatch Detected
                        </p>
                        <p className="text-red-600 text-sm">
                          You have Production mode selected but your Application ID appears to be a Sandbox ID.
                          Update your Application ID with your Production credentials from Square Dashboard.
                        </p>
                      </div>
                    )}
                    
                    {paymentSettings.square_environment === 'sandbox' && savedCredentials.application_id_prefix.startsWith('sq0idp-') && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-700 text-sm font-medium">
                          ⚠️ Environment Mismatch
                        </p>
                        <p className="text-yellow-600 text-sm">
                          You have Sandbox mode selected but your Application ID appears to be a Production ID.
                          Either switch to Production mode or update with Sandbox credentials.
                        </p>
                      </div>
                    )}
                    
                    {/* Square Location ID */}
                    <div className="space-y-2">
                      <Label htmlFor="square_location_id">Square Location ID</Label>
                      <Input
                        id="square_location_id"
                        value={paymentSettings.square_location_id}
                        onChange={(e) => setPaymentSettings(prev => ({ ...prev, square_location_id: e.target.value }))}
                        placeholder="Your Square location ID"
                      />
                      <p className="text-sm text-gray-600">
                        Found in your Square Dashboard → Locations → Location Details
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <Button onClick={savePaymentSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Payment Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Google Calendar Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-3">
                  {googleCalendar.isConnected ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium">
                      {googleCalendar.isConnected ? 'Connected' : 'Not Connected'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {googleCalendar.isConnected 
                        ? `Calendar: ${googleCalendar.calendarId || 'Default'}` 
                        : 'Connect your Google Calendar to sync bookings'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  {googleCalendar.isConnected ? (
                    <Button 
                      variant="outline" 
                      onClick={handleGoogleCalendarDisconnect}
                      className="flex items-center gap-2"
                    >
                      <Unlink className="h-4 w-4" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleGoogleCalendarAuth}
                      className="flex items-center gap-2"
                    >
                      <Link className="h-4 w-4" />
                      Connect Google Calendar
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <p>Google Calendar integration allows you to:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Sync bookings to your calendar</li>
                  <li>Block unavailable times automatically</li>
                  <li>Receive calendar notifications</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admins Tab */}
        <TabsContent value="admins" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Invite Admin
              </CardTitle>
              <p className="text-sm text-gray-600">
                Invite a new admin user by email. They will receive an email to set their password and access the admin portal.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invite_email">Email</Label>
                  <Input
                    id="invite_email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="admin@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite_name">Name (optional)</Label>
                  <Input
                    id="invite_name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Display name"
                  />
                </div>
              </div>
              <Button onClick={handleInviteAdmin} disabled={inviting}>
                {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Send Invite
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Admin Users
              </CardTitle>
              <p className="text-sm text-gray-600">
                Users who have access to the admin portal.
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {admins.length === 0 ? (
                <p className="text-sm text-gray-500">No admin users yet.</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {admins.map((admin) => (
                    <li key={admin.id} className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                          <Mail className="h-5 w-5 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{admin.name || admin.email}</p>
                          <p className="text-sm text-gray-500">{admin.email}</p>
                          {admin.last_login && (
                            <p className="text-xs text-gray-400">
                              Last login: {new Date(admin.last_login).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${admin.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {admin.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={disconnectDialog.open} onOpenChange={(open) => {
        if (!open) {
          setDisconnectDialog({
            open: false,
            type: null,
            title: '',
            description: ''
          })
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{disconnectDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {disconnectDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDisconnect}
              className="bg-red-600 hover:bg-red-700"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <AdminSettingsContent />
    </Suspense>
  )
}
