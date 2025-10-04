'use client'

import { Navigation } from '@/components/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { Service } from '@/types'

export default function Home() {
  const { user, loading } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [customer, setCustomer] = useState<{ is_existing_customer: boolean } | null>(null)

  // Fetch customer data when user is available
  useEffect(() => {
    const fetchCustomer = async () => {
      if (!user) {
        console.log('🔍 Homepage - No user, setting customer to null')
        setCustomer(null)
        return
      }

      console.log('🔍 Homepage - Fetching customer data for user:', user.email)
      try {
        const response = await fetch('/api/customer/me')
        const data = await response.json()
        
        console.log('🔍 Homepage - Customer API response:', data)
        
        if (data.customer) {
          console.log('🔍 Homepage - Setting customer:', data.customer)
          console.log('🔍 Homepage - is_existing_customer:', data.customer.is_existing_customer)
          setCustomer(data.customer)
        } else {
          console.log('❌ Homepage - No customer data received')
        }
      } catch (error) {
        console.error('❌ Homepage - Error fetching customer data:', error)
      }
    }

    fetchCustomer()
  }, [user])

  // Fetch services from API
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch('/api/services')
        const data = await response.json()
        
        if (data.services) {
          setServices(data.services)
        }
      } catch (error) {
        console.error('Error fetching services:', error)
      } finally {
        setServicesLoading(false)
      }
    }

    fetchServices()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50">
        <Navigation />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  const isLoggedIn = !!user

  return (
    <div className="min-h-screen bg-stone-50">
      <Navigation />
      
      <main>
        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          {/* DUST Title */}
          <div className="text-center mb-12">
            <h1 className="dust-heading text-[8rem] md:text-[12rem] lg:text-[16rem] xl:text-[20rem] 2xl:text-[24rem] leading-none" style={{ color: 'var(--dust-black)' }}>
              DUST
            </h1>
          </div>

          {/* Hero Content */}
          <div className="grid lg:grid-cols-3 gap-12 items-start">
            {/* Hero Image */}
            <div className="lg:col-span-2">
              <div className="relative aspect-[3/4] max-w-md mx-auto lg:mx-0">
                <Image
                  src="/homepage_images/BannerLuca.webp"
                  alt="Luca Tullio - DUST Hair Studio"
                  fill
                  className="object-cover rounded-sm"
                  priority
                />
              </div>
            </div>

            {/* Studio Description */}
            <div className="lg:col-span-1 space-y-6">
              <div className="space-y-2">
                <h2 className="dust-heading text-2xl md:text-3xl tracking-wide" style={{ color: 'var(--dust-black)' }}>
                  A PRIVATE HAIR STUDIO
                </h2>
                <h3 className="dust-heading text-2xl md:text-3xl tracking-wide" style={{ color: 'var(--dust-black)' }}>
                  BY LUCA TULLIO
                </h3>
              </div>
              
              <p className="dust-mono text-sm text-gray-700 leading-relaxed max-w-sm">
                DUST WAS BORN FROM A DESIRE TO CREATE A PRIVATE AND PERSONALIZED SALON EXPERIENCE FOR EACH INDIVIDUAL CLIENT AND THE HAIR THEY WEAR.
              </p>
            </div>
          </div>
        </div>

        {/* Booking Section */}
        <div className="bg-white py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="dust-heading text-4xl md:text-5xl mb-8 tracking-wide" style={{ color: 'var(--dust-black)' }}>
              BOOK AN APPOINTMENT
            </h2>
            
            <p className="dust-mono text-base text-gray-700 mb-4 max-w-2xl mx-auto leading-relaxed">
              If this is your first time here, welcome. It&apos;s important we have enough time together so please make sure you choose the appropriate appointment option. If you have any questions please don&apos;t hesitate to reach out through my booking page.
            </p>
            
            <p className="dust-mono text-base text-gray-700 mb-12 max-w-2xl mx-auto leading-relaxed">
              See you soon x
            </p>

            {/* Services List */}
            <div className="max-w-2xl mx-auto">
              {servicesLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="dust-mono text-sm text-gray-600 mt-2">Loading services...</p>
                </div>
              ) : (
                (() => {
                  console.log('🔍 Homepage - Services filtering:')
                  console.log('🔍 Homepage - Customer:', customer)
                  console.log('🔍 Homepage - customer?.is_existing_customer:', customer?.is_existing_customer)
                  console.log('🔍 Homepage - All services:', services)
                  
                  // Filter services based on customer type and service restrictions
                  const filteredServices = services.filter(service => {
                    console.log(`🔍 Service: ${service.name}, is_existing_customer_only: ${service.is_existing_customer_only}, is_new_customer_only: ${service.is_new_customer_only}`)
                    
                    // Hide new-customer-only services for existing customers
                    if (service.is_new_customer_only && customer?.is_existing_customer) {
                      console.log(`❌ Hiding service: ${service.name} (new customer only, but customer is existing)`)
                      return false
                    }
                    
                    // Hide existing-customer-only services for new customers
                    if (service.is_existing_customer_only && !customer?.is_existing_customer) {
                      console.log(`❌ Hiding service: ${service.name} (existing customer only, but customer is not existing)`)
                      return false
                    }
                    
                    console.log(`✅ Showing service: ${service.name}`)
                    return true
                  })
                  
                  console.log('🔍 Homepage - Filtered services:', filteredServices)

                  return filteredServices.map((service, index) => {
                    // For non-logged in users, show new customer pricing
                    const price = isLoggedIn && customer?.is_existing_customer ? service.existing_customer_price : service.new_customer_price;
                    const formattedPrice = price === 0 ? "Free" : `$${(price / 100).toFixed(2)}`;
                    
                    // Format duration
                    const hours = Math.floor(service.duration_minutes / 60);
                    const minutes = service.duration_minutes % 60;
                    const durationText = hours > 0 ? `${hours} hr${minutes > 0 ? ` ${minutes} min` : ''}` : `${minutes} min`;
                    
                    return (
                      <div key={service.id}>
                        <div className="text-left py-6 px-4">
                          <h3 className="dust-heading text-lg mb-2 tracking-wide" style={{ color: 'var(--dust-black)' }}>
                            {service.name}
                          </h3>
                          <p className="dust-mono text-sm text-gray-600 mb-2 leading-relaxed">
                            {service.description}
                          </p>
                          <p className="dust-mono text-sm text-gray-600 mb-3">
                            {formattedPrice} • {durationText}
                          </p>
                          <Button 
                            onClick={() => window.location.href = `/book?serviceId=${service.id}`}
                            className="w-full"
                          >
                            Book Now
                          </Button>
                        </div>
                        {index < filteredServices.length - 1 && <hr className="border-gray-200" />}
                      </div>
                    );
                  })
                })()
              )}
            </div>

          </div>
        </div>


        {/* Contact Section */}
        <div className="bg-white py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12">
              {/* Contact Info */}
              <div>
                <h3 className="dust-heading text-xl mb-4 tracking-wide" style={{ color: 'var(--dust-black)' }}>DUST</h3>
                <div className="dust-mono text-sm text-gray-700 space-y-2">
                  <p>1942 Riverside Dr. Los Angeles, CA 90039</p>
                  <p>Luca@dusthairstudio.com</p>
                </div>
              </div>

              {/* Hours */}
              <div>
                <h3 className="dust-heading text-xl mb-4 tracking-wide" style={{ color: 'var(--dust-black)' }}>HOURS</h3>
                <div className="dust-mono text-sm text-gray-700">
                  <p>Thursday-Sunday: By Appointment</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 mb-16">
              {/* Subscribe */}
              <div>
                <h3 className="dust-heading text-lg text-white mb-4 tracking-wide">SUBSCRIBE</h3>
                <p className="dust-mono text-sm text-gray-300 mb-6">
                  Sign up with your email address to receive news and updates.
                </p>
                <div className="flex gap-3">
                  <Input 
                    type="email" 
                    placeholder="Email Address" 
                    className="flex-1 bg-white border-white text-gray-900 placeholder-gray-500"
                  />
                  <Button className="bg-black text-white border border-white hover:bg-gray-800 px-6">
                    Sign Up
                  </Button>
                </div>
                <p className="dust-mono text-xs text-gray-400 mt-3">
                  We respect your privacy.
                </p>
              </div>

              {/* Follow */}
              <div>
                <h3 className="dust-heading text-lg text-white mb-4 tracking-wide">FOLLOW</h3>
                <a href="#" className="dust-mono text-sm text-white underline hover:no-underline">
                  INSTAGRAM
                </a>
              </div>
            </div>

            {/* Bottom Logo */}
            <div className="text-center">
              <div className="dust-heading text-[8rem] md:text-[12rem] lg:text-[16rem] xl:text-[20rem] 2xl:text-[24rem] text-white leading-none">
                DUST
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}