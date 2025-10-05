"use client"

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Calendar, Clock, Settings, Link, Unlink, CheckCircle, XCircle } from 'lucide-react'
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

const DAYS = [
  { value: 0, name: 'Sunday' },
  { value: 1, name: 'Monday' },
  { value: 2, name: 'Tuesday' },
  { value: 3, name: 'Wednesday' },
  { value: 4, name: 'Thursday' },
  { value: 5, name: 'Friday' },
  { value: 6, name: 'Saturday' }
]

function AdminScheduleContent() {
  const searchParams = useSearchParams()
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [googleCalendar, setGoogleCalendar] = useState<GoogleCalendarStatus>({
    isConnected: false,
    hasToken: false
  })

  // Initialize business hours with default values (Fri-Sun 11am-9pm PST)
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

  // Fetch current settings
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
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Failed to load schedule settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  // Handle OAuth callback
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const code = searchParams.get('code')
      const error = searchParams.get('error')

      if (error) {
        toast.error(`Google Calendar connection failed: ${error}`)
        return
      }

      if (code) {
        try {
          const response = await fetch('/api/admin/google-calendar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to connect Google Calendar')
          }

          toast.success('Google Calendar connected successfully!')
          
          // Reload Google Calendar status
          const calendarResponse = await fetch('/api/admin/google-calendar')
          if (calendarResponse.ok) {
            const calendarData = await calendarResponse.json()
            setGoogleCalendar(calendarData)
          }

          // Clean up URL parameters
          window.history.replaceState({}, document.title, window.location.pathname)
        } catch (err: unknown) {
          console.error('Error during Google Calendar callback:', err)
          toast.error(err instanceof Error ? err.message : 'Failed to connect Google Calendar')
        }
      }
    }

    handleOAuthCallback()
  }, [searchParams])

  // Update business hours
  const updateBusinessHours = (dayOfWeek: number, field: keyof BusinessHours, value: string | boolean) => {
    setBusinessHours(prev => prev.map(hours => 
      hours.day_of_week === dayOfWeek 
        ? { ...hours, [field]: value }
        : hours
    ))
  }

  // Save business hours
  const saveBusinessHours = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/admin/business-hours', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ businessHours })
      })

      if (!response.ok) {
        throw new Error('Failed to save business hours')
      }

      toast.success('Business hours saved successfully')
    } catch (error) {
      console.error('Error saving business hours:', error)
      toast.error('Failed to save business hours')
    } finally {
      setSaving(false)
    }
  }

  // Connect Google Calendar
  const connectGoogleCalendar = () => {
    if (googleCalendar.authUrl) {
      window.location.href = googleCalendar.authUrl
    }
  }

  // Disconnect Google Calendar
  const disconnectGoogleCalendar = async () => {
    try {
      const response = await fetch('/api/admin/google-calendar', {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to disconnect Google Calendar')
      }

      setGoogleCalendar({ isConnected: false, hasToken: false })
      toast.success('Google Calendar disconnected')
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error)
      toast.error('Failed to disconnect Google Calendar')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading schedule settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule Management</h1>
        <p className="text-gray-600">Manage your business hours and Google Calendar integration</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Business Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Business Hours</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {businessHours.map((hours) => (
              <div key={hours.day_of_week} className="flex items-center space-x-4">
                <div className="w-24">
                  <Label className="text-sm font-medium">{hours.day_name}</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={hours.is_open}
                    onCheckedChange={(checked) => updateBusinessHours(hours.day_of_week, 'is_open', checked)}
                  />
                  <span className="text-sm text-gray-600">
                    {hours.is_open ? 'Open' : 'Closed'}
                  </span>
                </div>

                {hours.is_open && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Label className="text-sm">From</Label>
                      <Input
                        type="time"
                        value={hours.open_time}
                        onChange={(e) => updateBusinessHours(hours.day_of_week, 'open_time', e.target.value)}
                        className="w-32"
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Label className="text-sm">To</Label>
                      <Input
                        type="time"
                        value={hours.close_time}
                        onChange={(e) => updateBusinessHours(hours.day_of_week, 'close_time', e.target.value)}
                        className="w-32"
                      />
                    </div>
                  </>
                )}
              </div>
            ))}

            <div className="pt-4 border-t">
              <Button 
                onClick={saveBusinessHours} 
                disabled={saving}
                className="w-full bg-black text-white hover:bg-gray-800"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Business Hours'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Google Calendar Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Google Calendar Integration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {googleCalendar.isConnected ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-400" />
                )}
                <span className="font-medium">
                  {googleCalendar.isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            </div>

            {googleCalendar.isConnected ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✅ Google Calendar is connected and syncing
                  </p>
                  {googleCalendar.calendarId && (
                    <p className="text-xs text-green-600 mt-1">
                      Calendar ID: {googleCalendar.calendarId}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Integration Features:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• New bookings automatically appear in your Google Calendar</li>
                    <li>• Blocked time in Google Calendar blocks availability in the system</li>
                    <li>• Two-way sync keeps everything in perfect harmony</li>
                  </ul>
                </div>

                <Button 
                  variant="outline" 
                  onClick={disconnectGoogleCalendar}
                  className="w-full"
                >
                  <Unlink className="w-4 h-4 mr-2" />
                  Disconnect Google Calendar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Connect your Google Calendar to enable two-way synchronization:
                  </p>
                </div>
                
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Bookings will automatically appear in your calendar</li>
                  <li>• Blocked time in your calendar will block availability</li>
                  <li>• Keep your schedule perfectly synchronized</li>
                </ul>

                <Button 
                  onClick={connectGoogleCalendar}
                  className="w-full"
                >
                  <Link className="w-4 h-4 mr-2" />
                  Connect Google Calendar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Setup Guide */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Quick Setup Guide</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Set Business Hours</h3>
              <p className="text-sm text-gray-600">
                Configure your working days and hours. Default is set to Friday-Sunday 11am-9pm PST.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 font-bold">2</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Connect Google Calendar</h3>
              <p className="text-sm text-gray-600">
                Link your Google Calendar for automatic booking sync and blocked time management.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h3 className="font-medium text-gray-900 mb-2">Start Booking</h3>
              <p className="text-sm text-gray-600">
                Your availability is now live! Customers can book appointments during your open hours.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminSchedulePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminScheduleContent />
    </Suspense>
  )
}
