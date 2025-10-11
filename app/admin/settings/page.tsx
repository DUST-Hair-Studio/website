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
import { Loader2, Calendar, Clock, Link, Unlink, CheckCircle, XCircle, CreditCard, Building, ListChecks } from 'lucide-react'
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
  payment_required: boolean
}

interface ScheduleSettings {
  buffer_time_minutes: number
}

interface WaitlistSettings {
  enabled: boolean
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
    type: 'google-calendar' | 'payments' | null
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
    payment_required: false
  })
  
  // Schedule Settings State
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>({
    buffer_time_minutes: 0
  })
  
  // Waitlist Settings State
  const [waitlistSettings, setWaitlistSettings] = useState<WaitlistSettings>({
    enabled: true
  })

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
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    
    // Check for tab parameter in URL
    const tab = searchParams.get('tab')
    if (tab && ['business', 'payments', 'integrations'].includes(tab)) {
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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6 h-auto p-1">
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
                    onCheckedChange={(checked) => setPaymentSettings(prev => ({ ...prev, square_enabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="payment_required">Payment Required</Label>
                    <p className="text-sm text-gray-600">Require payment at time of booking</p>
                  </div>
                  <Switch
                    id="payment_required"
                    checked={paymentSettings.payment_required}
                    onCheckedChange={(checked) => setPaymentSettings(prev => ({ ...prev, payment_required: checked }))}
                  />
                </div>
                {paymentSettings.square_enabled && (
                  <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <div className="space-y-2">
                      <Label htmlFor="square_application_id">Square Application ID</Label>
                      <Input
                        id="square_application_id"
                        type="password"
                        value={paymentSettings.square_application_id}
                        onChange={(e) => setPaymentSettings(prev => ({ ...prev, square_application_id: e.target.value }))}
                        placeholder="sq0idp-..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="square_access_token">Square Access Token</Label>
                      <Input
                        id="square_access_token"
                        type="password"
                        value={paymentSettings.square_access_token}
                        onChange={(e) => setPaymentSettings(prev => ({ ...prev, square_access_token: e.target.value }))}
                        placeholder="EAAA..."
                      />
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
