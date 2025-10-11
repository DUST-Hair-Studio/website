'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Bell, CheckCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface WaitlistFormProps {
  serviceId: string
  serviceName: string
  onSuccess?: () => void
  compact?: boolean // For inline display in booking flow
}

export default function WaitlistForm({
  serviceId,
  serviceName,
  onSuccess,
  compact = false
}: WaitlistFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Helper function to format YYYY-MM-DD to MM/DD/YYYY
  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return ''
    const [year, month, day] = dateString.split('-')
    return `${month}/${day}/${year}`
  }

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates')
      return
    }

    // Validate dates
    const startDateObj = new Date(startDate + 'T00:00:00') // Ensure local timezone
    const endDateObj = new Date(endDate + 'T00:00:00') // Ensure local timezone
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (startDateObj < today) {
      toast.error('Start date cannot be in the past')
      return
    }

    if (endDateObj < startDateObj) {
      toast.error('End date must be on or after start date')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          start_date: startDate,
          end_date: endDate
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add to waitlist')
      }

      setIsSuccess(true)
      toast.success('Added to waitlist! We\'ll notify you if an appointment becomes available.')
      
      // Reset form after success
      setTimeout(() => {
        setIsOpen(false)
        setIsSuccess(false)
        setStartDate('')
        setEndDate('')
        if (onSuccess) onSuccess()
      }, 2000)

    } catch (error) {
      console.error('Error adding to waitlist:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add to waitlist')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setStartDate('')
    setEndDate('')
    setIsSuccess(false)
    setIsOpen(false)
  }

  // Compact button for inline display
  if (compact) {
    return (
      <div className="mt-4 pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="w-full"
        >
          <Bell className="w-4 h-4 mr-2" />
          Join Waitlist - Get notified if a spot opens up
        </Button>

        {/* Modal for compact mode */}
        <Dialog open={isOpen} onOpenChange={(open) => {
          if (!open) {
            resetForm()
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Join Waitlist
              </DialogTitle>
              <DialogDescription>
                Get notified by email if an appointment becomes available for {serviceName}
              </DialogDescription>
            </DialogHeader>

            {isSuccess ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-xl font-medium text-green-600 mb-2">Added to Waitlist!</p>
                <p className="text-gray-600">
                  We&apos;ll email you if a spot opens up between {formatDisplayDate(startDate)} and {formatDisplayDate(endDate)}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Date Input Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Summary */}
                {startDate && endDate && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900 font-medium mb-2">
                      📅 You&apos;ll be notified if an appointment becomes available:
                    </p>
                    <p className="text-sm text-blue-800">
                      Between <strong>{formatDisplayDate(startDate)}</strong> and <strong>{formatDisplayDate(endDate)}</strong>
                    </p>
                    <p className="text-xs text-blue-700 mt-2">
                      Service: {serviceName}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={resetForm}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!startDate || !endDate || isSubmitting}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 mr-2" />
                        Join Waitlist
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Standalone card version (for dedicated pages) - currently using compact mode everywhere
  // If needed, can expand this to use the same Input date fields as compact mode
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="w-full"
      >
        <Bell className="w-4 h-4 mr-2" />
        Join Waitlist - Get notified if a spot opens up
      </Button>

      {/* Modal for standalone mode */}
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          resetForm()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Join Waitlist
            </DialogTitle>
            <DialogDescription>
              Get notified by email if an appointment becomes available for {serviceName}
            </DialogDescription>
          </DialogHeader>

          {isSuccess ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <p className="text-xl font-medium text-green-600 mb-2">Added to Waitlist!</p>
              <p className="text-gray-600">
                We&apos;ll email you if a spot opens up between {formatDisplayDate(startDate)} and {formatDisplayDate(endDate)}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Date Input Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date-standalone">Start Date</Label>
                  <Input
                    id="start-date-standalone"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date-standalone">End Date</Label>
                  <Input
                    id="end-date-standalone"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split('T')[0]}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Summary */}
              {startDate && endDate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900 font-medium mb-2">
                    📅 You&apos;ll be notified if an appointment becomes available:
                  </p>
                  <p className="text-sm text-blue-800">
                    Between <strong>{formatDisplayDate(startDate)}</strong> and <strong>{formatDisplayDate(endDate)}</strong>
                  </p>
                  <p className="text-xs text-blue-700 mt-2">
                    Service: {serviceName}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!startDate || !endDate || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Join Waitlist
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

