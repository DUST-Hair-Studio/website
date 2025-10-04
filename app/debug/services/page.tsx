'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ServiceWithBookings {
  id: string
  name: string
  is_active: boolean
  bookings: Array<{
    id: string
    booking_date: string
    booking_time: string
  }>
  bookingsError: string | null
}

export default function DebugServicesPage() {
  const [services, setServices] = useState<ServiceWithBookings[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('/api/debug/services')
        const data = await response.json()
        setServices(data.services || [])
      } catch (error) {
        console.error('Error fetching services:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchServices()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading services...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Debug Services</h1>
      
      <div className="grid gap-6">
        {services.map((service) => (
          <Card key={service.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{service.name}</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  service.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {service.is_active ? 'Active' : 'Inactive'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Service ID:</strong> {service.id}</p>
                <p><strong>Bookings Count:</strong> {service.bookings.length}</p>
                {service.bookingsError && (
                  <p className="text-red-600"><strong>Error:</strong> {service.bookingsError}</p>
                )}
                {service.bookings.length > 0 && (
                  <div>
                    <p><strong>Bookings:</strong></p>
                    <ul className="list-disc list-inside ml-4">
                      {service.bookings.map((booking) => (
                        <li key={booking.id}>
                          {booking.booking_date} at {booking.booking_time}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
