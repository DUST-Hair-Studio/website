'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Calendar as CalendarIcon, Clock, Search, User, Scissors, AlertCircle, Loader2, Plus, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { toast } from 'sonner'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  is_existing_customer: boolean
}

interface Service {
  id: string
  name: string
  description?: string
  duration_minutes: number
  new_customer_price: number
  existing_customer_price: number
  is_active: boolean
  is_new_customer: boolean
  is_existing_customer: boolean
}

interface ConflictingBooking {
  id: string
  booking_time: string
  duration_minutes: number
  status: string
  customers: { name: string } | null
}

interface TimeSlotWithConflict {
  time: string
  hasConflict: boolean
  conflictInfo?: string
}

interface AdminBookModalProps {
  isOpen: boolean
  onClose: () => void
  onBookingSuccess?: () => void
}

type Step = 'customer' | 'service' | 'datetime' | 'review'

export default function AdminBookModal({
  isOpen,
  onClose,
  onBookingSuccess
}: AdminBookModalProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('customer')

  // Customer selection state
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // Service selection state
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  // Date/time selection state
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [timeSlotsWithConflicts, setTimeSlotsWithConflicts] = useState<TimeSlotWithConflict[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)

  // Public notes
  const [publicNotes, setPublicNotes] = useState('')

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)

  const steps: { id: Step; label: string }[] = [
    { id: 'customer', label: 'Customer' },
    { id: 'service', label: 'Service' },
    { id: 'datetime', label: 'Date & Time' },
    { id: 'review', label: 'Review' },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('customer')
      setSelectedCustomer(null)
      setCustomerSearch('')
      setSelectedService(null)
      setSelectedDate(undefined)
      setSelectedTime('')
      setTimeSlotsWithConflicts([])
      setPublicNotes('')
    }
  }, [isOpen])

  // Fetch customers on mount
  useEffect(() => {
    if (isOpen && customers.length === 0) {
      fetchCustomers()
    }
  }, [isOpen, customers.length])

  // Fetch services on mount
  useEffect(() => {
    if (isOpen && services.length === 0) {
      fetchServices()
    }
  }, [isOpen, services.length])

  const fetchCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const response = await fetch('/api/admin/customers')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.customers || [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoadingCustomers(false)
    }
  }

  const fetchServices = async () => {
    setLoadingServices(true)
    try {
      const response = await fetch('/api/admin/services')
      if (response.ok) {
        const data = await response.json()
        setServices((data.services || []).filter((s: Service) => s.is_active))
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoadingServices(false)
    }
  }

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 20)
    const search = customerSearch.toLowerCase()
    return customers.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.email.toLowerCase().includes(search) ||
      c.phone.includes(search)
    ).slice(0, 20)
  }, [customers, customerSearch])

  // Filter services based on selected customer type
  const filteredServices = useMemo(() => {
    if (!selectedCustomer) return services
    
    return services.filter(service => {
      if (selectedCustomer.is_existing_customer) {
        // Existing customer: show services that allow existing customers
        return service.is_existing_customer
      } else {
        // New customer: show services that allow new customers
        return service.is_new_customer
      }
    })
  }, [services, selectedCustomer])

  // Generate all time slots (6 AM - 10 PM)
  const generateAllTimeSlots = (): string[] => {
    const slots: string[] = []
    for (let hour = 6; hour <= 22; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 22 && minute > 0) break
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const displayMinute = minute.toString().padStart(2, '0')
        slots.push(`${displayHour}:${displayMinute} ${ampm}`)
      }
    }
    return slots
  }

  // Convert display time to 24-hour format
  const displayTimeTo24Hour = (displayTime: string): string => {
    const match = displayTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
    if (!match) return displayTime
    
    let hour = parseInt(match[1])
    const minute = match[2]
    const period = match[3].toUpperCase()
    
    if (period === 'PM' && hour !== 12) hour += 12
    if (period === 'AM' && hour === 12) hour = 0
    
    return `${hour.toString().padStart(2, '0')}:${minute}:00`
  }

  // Check time conflict
  const checkTimeConflict = (
    slotTime: string, 
    serviceDuration: number, 
    existingBookings: ConflictingBooking[]
  ): { hasConflict: boolean; conflictInfo?: string } => {
    const slotTime24 = displayTimeTo24Hour(slotTime)
    const [slotHour, slotMinute] = slotTime24.split(':').map(Number)
    const slotStartMinutes = slotHour * 60 + slotMinute
    const slotEndMinutes = slotStartMinutes + serviceDuration

    for (const booking of existingBookings) {
      const [bookingHour, bookingMinute] = booking.booking_time.split(':').map(Number)
      const bookingStartMinutes = bookingHour * 60 + bookingMinute
      const bookingEndMinutes = bookingStartMinutes + booking.duration_minutes

      if (slotStartMinutes < bookingEndMinutes && slotEndMinutes > bookingStartMinutes) {
        const customerName = booking.customers?.name || 'Unknown'
        return { 
          hasConflict: true, 
          conflictInfo: `Conflicts with ${customerName}'s appointment`
        }
      }
    }

    return { hasConflict: false }
  }

  // Fetch conflicts for date
  const fetchConflictsForDate = async (date: Date): Promise<ConflictingBooking[]> => {
    try {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      const response = await fetch(`/api/admin/bookings/by-date?date=${dateStr}`)
      
      if (!response.ok) return []
      
      const data = await response.json()
      return data.bookings || []
    } catch (error) {
      console.error('Error fetching conflicts:', error)
      return []
    }
  }

  // Handle date selection
  const handleDateSelect = async (date: Date | undefined) => {
    setSelectedDate(date)
    setSelectedTime('')
    setTimeSlotsWithConflicts([])
    
    if (date && selectedService) {
      await fetchTimeSlotsWithConflicts(date)
    }
  }

  // Fetch time slots with conflicts
  const fetchTimeSlotsWithConflicts = async (date: Date) => {
    if (!selectedService) return

    setLoadingTimes(true)
    try {
      const allSlots = generateAllTimeSlots()
      const conflicts = await fetchConflictsForDate(date)
      
      const slotsWithConflicts: TimeSlotWithConflict[] = allSlots.map(time => {
        const conflict = checkTimeConflict(time, selectedService.duration_minutes, conflicts)
        return {
          time,
          hasConflict: conflict.hasConflict,
          conflictInfo: conflict.conflictInfo
        }
      })
      
      setTimeSlotsWithConflicts(slotsWithConflicts)
    } catch (error) {
      console.error('Error generating time slots:', error)
    } finally {
      setLoadingTimes(false)
    }
  }

  // Calculate price based on selected customer and service
  const calculatedPrice = useMemo(() => {
    if (!selectedCustomer || !selectedService) return null
    const price = selectedCustomer.is_existing_customer 
      ? selectedService.existing_customer_price 
      : selectedService.new_customer_price
    return price / 100
  }, [selectedCustomer, selectedService])

  // Handle booking submission
  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedService || !selectedDate || !selectedTime) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    try {
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      const response = await fetch('/api/admin/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          serviceId: selectedService.id,
          date: dateStr,
          time: selectedTime,
          publicNotes: publicNotes.trim() || undefined
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create booking')
      }

      toast.success(`Booking created for ${selectedCustomer.name}`)
      
      if (onBookingSuccess) {
        onBookingSuccess()
      }
      
      onClose()
    } catch (error) {
      console.error('Error creating booking:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create booking')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const canProceed = () => {
    switch (currentStep) {
      case 'customer': return !!selectedCustomer
      case 'service': return !!selectedService
      case 'datetime': return !!selectedDate && !!selectedTime
      case 'review': return true
      default: return false
    }
  }

  const goNext = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id)
    }
  }

  const goBack = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[600px] max-h-[90dvh] sm:max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="text-center">
          <DialogTitle className="text-base sm:text-lg">
            Book Appointment
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Create a new appointment on behalf of a customer
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator - Compact on mobile */}
        <div className="py-2 sm:py-4">
          <div className="flex items-center justify-between gap-0 sm:gap-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center w-full">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium shrink-0 transition-colors ${
                      index < currentStepIndex
                        ? 'bg-green-500 text-white'
                        : index === currentStepIndex
                        ? 'bg-black text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {index < currentStepIndex ? (
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={`text-[10px] sm:text-xs mt-0.5 sm:mt-1 truncate w-full text-center ${
                    index <= currentStepIndex ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-0.5 sm:mx-2 mb-5 min-w-2">
                    <div className={`h-0.5 ${
                      index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 sm:py-4 px-0 sm:px-1 min-h-0">
          {/* Step 1: Customer Selection */}
          {currentStep === 'customer' && (
            <div className="space-y-3 sm:space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="pl-10 min-h-10"
                  autoFocus
                />
              </div>

              <div className="space-y-2 max-h-[min(350px,50vh)] sm:max-h-[350px] overflow-y-auto -mx-0.5 px-0.5">
                {loadingCustomers ? (
                  <div className="text-center py-8 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
                    Loading customers...
                  </div>
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map(customer => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer(customer)
                        setSelectedService(null)
                        setCurrentStep('service')
                      }}
                      className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-colors min-h-[52px] touch-manipulation ${
                        selectedCustomer?.id === customer.id
                          ? 'border-black bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-gray-500">{customer.email}</div>
                          <div className="text-sm text-gray-400">{customer.phone}</div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          customer.is_existing_customer 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {customer.is_existing_customer ? 'Loyalty' : 'New'}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No customers found
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Service Selection */}
          {currentStep === 'service' && (
            <div className="space-y-2 max-h-[min(400px,55vh)] sm:max-h-[400px] overflow-y-auto -mx-0.5 px-0.5">
              {loadingServices ? (
                <div className="text-center py-8 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin inline mr-2" />
                  Loading services...
                </div>
              ) : filteredServices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No services available for {selectedCustomer?.is_existing_customer ? 'loyalty' : 'new'} customers.</p>
                </div>
              ) : (
                filteredServices.map(service => {
                  const price = selectedCustomer?.is_existing_customer
                    ? service.existing_customer_price
                    : service.new_customer_price
                  return (
                    <button
                      key={service.id}
                      onClick={() => {
                        setSelectedService(service)
                        setCurrentStep('datetime')
                      }}
                      className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-colors min-h-[52px] touch-manipulation ${
                        selectedService?.id === service.id
                          ? 'border-black bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{service.name}</div>
                          <div className="text-sm text-gray-500">{service.duration_minutes} minutes</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${(price / 100).toFixed(2)}</div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}

          {/* Step 3: Date & Time Selection */}
          {currentStep === 'datetime' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="overflow-x-auto -mx-1">
                <h3 className="font-medium mb-2 sm:mb-3 flex items-center text-sm sm:text-base">
                  <CalendarIcon className="w-4 h-4 mr-2 shrink-0" />
                  Select Date
                </h3>
                <div className="flex justify-center min-w-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={(date) => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      return date < today
                    }}
                    className="rounded-md border"
                  />
                </div>
              </div>

              {selectedDate && (
                <div className="min-w-0">
                  <h3 className="font-medium mb-2 sm:mb-3 flex items-center text-sm sm:text-base wrap-break-word">
                    <Clock className="w-4 h-4 mr-2 shrink-0" />
                    <span className="min-w-0">Select Time – {formatDate(selectedDate)}</span>
                  </h3>
                  {loadingTimes ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                      Loading time slots...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[220px] sm:max-h-[200px] overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5">
                      {timeSlotsWithConflicts.map((slot, index) => {
                        const isSelected = selectedTime === slot.time
                        return (
                          <Button
                            key={`${slot.time}-${index}`}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTime(slot.time)
                              setCurrentStep('review')
                            }}
                            className={`min-h-9 sm:min-h-8 text-xs sm:text-sm ${
                              isSelected 
                                ? 'bg-black text-white border-black hover:bg-black hover:text-white' 
                                : slot.hasConflict 
                                  ? 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800' 
                                  : 'hover:bg-gray-50'
                            }`}
                          >
                            <span className="truncate">{slot.time}</span>
                            {slot.hasConflict && !isSelected && (
                              <AlertCircle className="w-3 h-3 ml-1 shrink-0" />
                            )}
                          </Button>
                        )
                      })}
                    </div>
                  )}
                  {selectedTime && timeSlotsWithConflicts.find(s => s.time === selectedTime)?.hasConflict && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                      ⚠️ {timeSlotsWithConflicts.find(s => s.time === selectedTime)?.conflictInfo}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 'review' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-3">
                <h3 className="font-semibold text-base sm:text-lg">Booking Summary</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Customer</div>
                    <div className="font-medium">{selectedCustomer?.name}</div>
                    <div className="text-gray-500 text-xs">{selectedCustomer?.email}</div>
                  </div>
                  
                  <div>
                    <div className="text-gray-500">Service</div>
                    <div className="font-medium">{selectedService?.name}</div>
                    <div className="text-gray-500 text-xs">{selectedService?.duration_minutes} minutes</div>
                  </div>
                  
                  <div>
                    <div className="text-gray-500">Date</div>
                    <div className="font-medium">{selectedDate ? formatDate(selectedDate) : '—'}</div>
                  </div>
                  
                  <div>
                    <div className="text-gray-500">Time</div>
                    <div className="font-medium">{selectedTime || '—'}</div>
                  </div>
                </div>

                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Total Price</span>
                    <span className="text-xl font-bold text-green-600">
                      ${calculatedPrice?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Public Notes (optional)</label>
                <Textarea
                  placeholder="Notes visible to the customer..."
                  value={publicNotes}
                  onChange={(e) => setPublicNotes(e.target.value)}
                  rows={3}
                  className="text-base"
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons - full-width touch targets on mobile */}
        <div className="flex gap-2 justify-between pt-3 sm:pt-4 border-t shrink-0">
          <Button
            variant="outline"
            onClick={currentStepIndex === 0 ? onClose : goBack}
            disabled={isSubmitting}
            className="flex-1 sm:flex-initial min-h-10 sm:min-h-9 touch-manipulation"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {currentStepIndex === 0 ? 'Cancel' : 'Back'}
          </Button>

          {currentStep === 'review' ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial min-h-10 sm:min-h-9 touch-manipulation"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Booking
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={!canProceed()}
              className="flex-1 sm:flex-initial min-h-10 sm:min-h-9 touch-manipulation"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
