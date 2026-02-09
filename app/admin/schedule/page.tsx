"use client"

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Calendar, Clock, Settings, ExternalLink, CalendarPlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type AvailabilityOverride = {
  id: string
  date: string
  open_time: string
  close_time: string
  created_at?: string
}

function AdminScheduleContent() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [googleCalendar, setGoogleCalendar] = useState({
    isConnected: false,
    calendarId: null
  })
  const [fixedSchedule, setFixedSchedule] = useState<{
    businessHours: Array<{ day_of_week: number; day_name: string; is_open: boolean; open_time: string; close_time: string }>
    booking_available_from_date: string | null
  } | null>(null)
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([])
  const [overridesLoading, setOverridesLoading] = useState(false)
  const [addDate, setAddDate] = useState('')
  const [addOpenTime, setAddOpenTime] = useState('11:00')
  const [addCloseTime, setAddCloseTime] = useState('21:00')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch Google Calendar status and fixed schedule (business hours + booking start date)
  const fetchScheduleData = async () => {
    try {
      setLoading(true)
      const [calResponse, hoursResponse] = await Promise.all([
        fetch('/api/admin/google-calendar'),
        fetch('/api/admin/business-hours')
      ])
      if (calResponse.ok) {
        const data = await calResponse.json()
        setGoogleCalendar(data)
      }
      if (hoursResponse.ok) {
        const data = await hoursResponse.json()
        setFixedSchedule({
          businessHours: data.businessHours || [],
          booking_available_from_date: data.booking_available_from_date || null
        })
      }
    } catch (error) {
      console.error('Error fetching schedule data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOverrides = useCallback(async () => {
    setOverridesLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/admin/availability-overrides?startDate=${today}`)
      if (res.ok) {
        const data = await res.json()
        setOverrides(data.overrides || [])
      }
    } catch (e) {
      console.error('Error fetching overrides:', e)
    } finally {
      setOverridesLoading(false)
    }
  }, [])

  const handleAddOverride = async () => {
    if (!addDate.trim()) {
      toast.error('Please select a date')
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/admin/availability-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: addDate,
          open_time: addOpenTime,
          close_time: addCloseTime
        })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to add')
      }
      toast.success('Date opened for booking')
      setAddDate('')
      setAddOpenTime('11:00')
      setAddCloseTime('21:00')
      await fetchOverrides()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add date')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteOverride = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/availability-overrides/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to remove')
      toast.success('Date removed')
      await fetchOverrides()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove')
    } finally {
      setDeletingId(null)
    }
  }

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async () => {
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
        await fetchScheduleData()
      } catch (error) {
        console.error('Google Calendar callback error:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to connect Google Calendar')
      }
    }
  }, [searchParams])

  useEffect(() => {
    fetchScheduleData()
  }, [])

  useEffect(() => {
    if (!loading) fetchOverrides()
  }, [loading, fetchOverrides])

  useEffect(() => {
    handleOAuthCallback()
  }, [searchParams, handleOAuthCallback])

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
        {/* Fixed Schedule (business hours + booking start date) - works without Google */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Fixed Schedule</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm text-gray-600">
              Set your weekly hours and when booking opens. This works even if Google Calendar is not connected.
            </p>
            {fixedSchedule && (
              <div className="space-y-2 text-sm">
                <div className="font-medium text-gray-700">Open days</div>
                {fixedSchedule.businessHours
                  .filter(h => h.is_open)
                  .map(h => (
                    <div key={h.day_of_week} className="text-gray-600">
                      {h.day_name}: {h.open_time} – {h.close_time}
                    </div>
                  ))}
                {fixedSchedule.businessHours.filter(h => h.is_open).length === 0 && (
                  <p className="text-amber-600">No days set. Add hours in Settings → Schedule.</p>
                )}
                {fixedSchedule.booking_available_from_date ? (
                  <p className="text-gray-600 mt-2">
                    Booking opens from: <strong>{new Date(fixedSchedule.booking_available_from_date + 'T00:00:00').toLocaleDateString()}</strong>
                  </p>
                ) : (
                  <p className="text-gray-500 mt-2">Booking from today (no start date set)</p>
                )}
              </div>
            )}
            <div className="pt-3 sm:pt-4 border-t">
              <Link href="/admin/settings?tab=schedule">
                <Button variant="outline" className="w-full text-sm sm:text-base">
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Set business hours &amp; booking start date
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

      {/* One-time open dates */}
      <Card className="mt-6">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center space-x-2 text-base sm:text-lg">
            <CalendarPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>One-time open dates</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs sm:text-sm text-gray-600">
            Open specific dates that are normally closed (e.g. you usually work Thu–Sun but want to open Wednesday for one day).
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Open</label>
              <input
                type="time"
                value={addOpenTime}
                onChange={(e) => setAddOpenTime(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">Close</label>
              <input
                type="time"
                value={addCloseTime}
                onChange={(e) => setAddCloseTime(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <Button
              onClick={handleAddOverride}
              disabled={adding || !addDate}
              size="sm"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add date'}
            </Button>
          </div>

          <div>
            <h4 className="font-medium text-sm text-gray-900 mb-2">Upcoming open dates</h4>
            {overridesLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : overrides.length === 0 ? (
              <p className="text-sm text-gray-500">None added yet.</p>
            ) : (
              <ul className="space-y-2">
                {overrides.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <span>
                      <strong>{new Date(o.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                      {' '}
                      {o.open_time} – {o.close_time}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteOverride(o.id)}
                      disabled={deletingId === o.id}
                    >
                      {deletingId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
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
