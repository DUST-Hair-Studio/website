"use client"

import { useState, useEffect, Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Calendar, Clock, Settings, ExternalLink } from 'lucide-react'
import Link from 'next/link'

function AdminScheduleContent() {
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

  useEffect(() => {
    fetchGoogleCalendarStatus()
  }, [])

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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Schedule Management</h1>
        <p className="text-gray-600">Monitor your schedule status and manage availability</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Schedule Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5" />
              <span>Schedule Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="font-medium text-green-800">Schedule Active</span>
                </div>
                <span className="text-sm text-green-600">Live</span>
              </div>
              
              <div className="text-sm text-gray-600">
                <p>Your booking system is currently active and accepting appointments.</p>
                <p className="mt-1">Customers can book during your configured business hours.</p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Link href="/admin/settings">
                <Button variant="outline" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Schedule Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Google Calendar Status */}
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
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                ) : (
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
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
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    Google Calendar integration is not connected. Connect it to enable two-way synchronization.
                  </p>
                </div>
              </div>
            )}
            
            <div className="pt-4 border-t">
              <Link href="/admin/settings">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Manage Integrations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/admin/settings">
              <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2">
                <Settings className="w-6 h-6" />
                <div className="text-center">
                  <div className="font-medium">Business Settings</div>
                  <div className="text-sm text-gray-600">Configure business hours, contact info, and timezone</div>
                </div>
              </Button>
            </Link>
            
            <Link href="/admin/settings">
              <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2">
                <Calendar className="w-6 h-6" />
                <div className="text-center">
                  <div className="font-medium">Integrations</div>
                  <div className="text-sm text-gray-600">Manage Google Calendar and other integrations</div>
                </div>
              </Button>
            </Link>
            
            <Link href="/admin/bookings">
              <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2">
                <Clock className="w-6 h-6" />
                <div className="text-center">
                  <div className="font-medium">View Bookings</div>
                  <div className="text-sm text-gray-600">See all current and upcoming appointments</div>
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
