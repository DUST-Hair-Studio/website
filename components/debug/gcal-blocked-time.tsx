'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BlockedSlot {
  date: string
  start_time: string
  end_time: string
}

interface DiagnosticResult {
  connection: {
    isConnected: boolean
    hasAccessToken: boolean
    hasRefreshToken: boolean
    hasCalendarId: boolean
    tokenStatus?: string
    hoursUntilExpiry?: number
  }
  testFetch: {
    success: boolean
    blockedSlotCount: number
    blockedSlots: BlockedSlot[]
    error: string | null
  }
}

export function GCalBlockedTime() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const testBlockedTime = async () => {
    if (!startDate || !endDate) {
      setError('Please provide both start and end dates')
      return
    }

    setLoading(true)
    setError(null)
    setDiagnostics(null)
    
    try {
      const response = await fetch(`/api/debug/gcal-test?startDate=${startDate}&endDate=${endDate}`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      
      console.log('🔍 Full Diagnostic Response:', data)
      
      setDiagnostics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Set default dates to current month
  const setDefaultDates = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    
    const formatDate = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    setStartDate(formatDate(firstDay))
    setEndDate(formatDate(lastDay))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Calendar Blocked Time Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={testBlockedTime} disabled={loading}>
            {loading ? 'Testing...' : 'Test Google Calendar Sync'}
          </Button>
          <Button onClick={setDefaultDates} variant="outline">
            Set Current Month
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 font-medium">Error:</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {diagnostics && (
          <div className="space-y-4">
            {/* Connection Status */}
            <div className={`p-4 border rounded-lg ${diagnostics.connection.isConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                {diagnostics.connection.isConnected ? '✅' : '❌'} Connection Status
              </h4>
              <div className="text-sm space-y-1">
                <p>Connected: {diagnostics.connection.isConnected ? 'Yes' : 'No'}</p>
                <p>Access Token: {diagnostics.connection.hasAccessToken ? 'Present' : 'Missing'}</p>
                <p>Refresh Token: {diagnostics.connection.hasRefreshToken ? 'Present' : 'Missing'}</p>
                <p>Calendar ID: {diagnostics.connection.hasCalendarId ? 'Present' : 'Missing'}</p>
                {diagnostics.connection.tokenStatus && (
                  <p className={diagnostics.connection.tokenStatus === 'VALID' ? 'text-green-700' : 'text-red-700'}>
                    Token: {diagnostics.connection.tokenStatus} 
                    {diagnostics.connection.hoursUntilExpiry !== undefined && 
                      ` (${diagnostics.connection.hoursUntilExpiry}h)`}
                  </p>
                )}
              </div>
            </div>

            {/* Fetch Results */}
            <div className={`p-4 border rounded-lg ${diagnostics.testFetch.success ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
              <h4 className="font-medium mb-2">
                {diagnostics.testFetch.success ? '✅' : '⚠️'} Event Fetch Test
              </h4>
              {diagnostics.testFetch.success ? (
                <div className="text-sm space-y-2">
                  <p className="font-medium">Found {diagnostics.testFetch.blockedSlotCount} blocked time slot(s)</p>
                  {diagnostics.testFetch.blockedSlots.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {diagnostics.testFetch.blockedSlots.map((slot, i) => (
                        <div key={i} className="p-2 bg-white rounded border border-blue-300">
                          <p className="font-mono text-xs">
                            📅 {slot.date} | ⏰ {slot.start_time} - {slot.end_time}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm">
                  <p className="text-orange-700">Failed to fetch events</p>
                  {diagnostics.testFetch.error && (
                    <p className="text-xs text-orange-600 mt-1">{diagnostics.testFetch.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="font-medium mb-2">Instructions:</h4>
          <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
            <li>Set a date range (or use "Set Current Month")</li>
            <li>Click "Test Google Calendar Sync"</li>
            <li>Check your server console/terminal for detailed logs with 🔍 🔴 ✅ emojis</li>
            <li>Logs will show:
              <ul className="ml-6 mt-1 list-disc list-inside">
                <li>Connection status</li>
                <li>Events fetched from Google Calendar</li>
                <li>Which events are external (not from your booking system)</li>
                <li>All-day vs timed events</li>
                <li>Blocked time slots created</li>
              </ul>
            </li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}

