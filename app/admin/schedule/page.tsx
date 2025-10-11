"use client"

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Calendar, Clock, Settings, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

function AdminScheduleContent() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [googleCalendar, setGoogleCalendar] = useState({
    isConnected: false,
    calendarId: null
  })

  // Fetch Google Calendar status
  const fetchGoogleCalendarStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/google-calendar')
      if (response.ok) {
        const data = await response.json()
        setGoogleCalendar(data)
      }
    } catch (error) {
      console.error('Error fetching Google Calendar status:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle OAuth callback
  const handleOAuthCallback = async () => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      toast.error(`Authorization failed: ${error}`)
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

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to connect Google Calendar')
        }

        toast.success('Google Calendar connected successfully!')
        
        // Refresh the calendar status
        await fetchGoogleCalendarStatus()
      } catch (error) {
        console.error('Google Calendar callback error:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to connect Google Calendar')
      }
    }
  }

  useEffect(() => {
    fetchGoogleCalendarStatus()
  }, [])

  useEffect(() => {
    handleOAuthCallback()
  }, [searchParams])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading schedule status...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Schedule Management</h1>
        <p className="text-sm sm:text-base text-gray-600">Monitor your schedule status and manage availability</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Schedule Status */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Schedule Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium text-sm sm:text-base text-green-800">Schedule Active</span>
                </div>
                <span className="text-xs sm:text-sm text-green-600">Live</span>
              </div>
              
              <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                <p>Your booking system is currently active and accepting appointments.</p>
                <p>Customers can book during your configured business hours.</p>
              </div>
            </div>
            
            <div className="pt-3 sm:pt-4 border-t">
              <Link href="/admin/settings">
                <Button variant="outline" className="w-full text-sm sm:text-base">
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Manage Schedule Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Google Calendar Status */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Google Calendar Integration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {googleCalendar.isConnected ? (
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                ) : (
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                )}
                <span className="font-medium text-sm sm:text-base">
                  {googleCalendar.isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            </div>

            {googleCalendar.isConnected ? (
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-green-800">
                    ✅ Google Calendar is connected and syncing
                  </p>
                  {googleCalendar.calendarId && (
                    <p className="text-xs text-green-600 mt-1 break-all">
                      Calendar ID: {googleCalendar.calendarId}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-sm sm:text-base text-gray-900">Integration Features:</h4>
                  <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                    <li>• New bookings automatically appear in your Google Calendar</li>
                    <li>• Blocked time in Google Calendar blocks availability in the system</li>
                    <li>• Two-way sync keeps everything in perfect harmony</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-600">
                    Google Calendar integration is not connected. Connect it to enable two-way synchronization.
                  </p>
                </div>
              </div>
            )}
            
            <div className="pt-3 sm:pt-4 border-t">
              <Link href="/admin/settings?tab=integrations">
                <Button variant="outline" className="w-full text-sm sm:text-base">
                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Manage Integrations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6 sm:mt-8">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
            <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link href="/admin/settings">
              <Button variant="outline" className="w-full h-auto p-3 sm:p-4 flex flex-col items-center space-y-2">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                <div className="text-center">
                  <div className="font-medium text-sm sm:text-base">Business Settings</div>
                  <div className="text-xs sm:text-sm text-gray-600 leading-tight">Configure business hours, contact info, and timezone</div>
                </div>
              </Button>
            </Link>
            
            <Link href="/admin/settings?tab=integrations">
              <Button variant="outline" className="w-full h-auto p-3 sm:p-4 flex flex-col items-center space-y-2">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                <div className="text-center">
                  <div className="font-medium text-sm sm:text-base">Integrations</div>
                  <div className="text-xs sm:text-sm text-gray-600 leading-tight">Manage Google Calendar and other integrations</div>
                </div>
              </Button>
            </Link>
            
            <Link href="/admin/bookings">
              <Button variant="outline" className="w-full h-auto p-3 sm:p-4 flex flex-col items-center space-y-2 sm:col-span-2 lg:col-span-1">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                <div className="text-center">
                  <div className="font-medium text-sm sm:text-base">View Bookings</div>
                  <div className="text-xs sm:text-sm text-gray-600 leading-tight">See all current and upcoming appointments</div>
                </div>
              </Button>
            </Link>
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
