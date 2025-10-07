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
        setCustomer(null)
        return
      }

      try {
        const response = await fetch('/api/customer/me')
        const data = await response.json()
        
        if (data.customer) {
          setCustomer(data.customer)
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
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAFA' }}>
      <Navigation />
      
      <main>
        {/* DUST Title Section */}
        <div className="w-full text-center pt-4 pb-2 px-4 overflow-hidden" style={{ backgroundColor: '#F5F5F3' }}>
          <h1 className="dust-heading text-[9.5rem] xs:text-[10rem] sm:text-[12rem] md:text-[24rem] lg:text-[26rem] xl:text-[34rem] 2xl:text-[40rem] -ml-5" style={{ color: '#1C1C1D' }}>
            DUST
          </h1>
        </div>

        {/* Hero Section */}
        <div className="border-b border-black" style={{ backgroundColor: '#F5F5F3' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 2xl:px-2 pt-2 sm:pt-4">
            {/* Desktop Layout - Side by side */}
            <div className="hidden lg:flex lg:items-start lg:relative">
              {/* Hero Image - Larger on desktop */}
              <div className="relative aspect-[3/4] max-h-[800px] lg:max-h-[900px] w-[600px] lg:w-[800px] -ml-32 lg:-ml-0 xl:-ml-0 2xl:-ml-30">
                <Image
                  src="/homepage_images/BannerLuca.webp"
                  alt="Luca Tullio - DUST Hair Studio"
                  fill
                  className="object-cover object-bottom"
                  priority
                />
              </div>

              {/* Text Content - Two distinct blocks */}
              <div className="flex flex-col justify-start ml-16 ">
                {/* First text block - positioned at top of image */}
                <div className="space-y-1">
                  <h2 className="dust-heading 2xl:text-5xl xl:text-4xl lg:text-3xl tracking-narrow leading-tight" style={{ color: 'var(--dust-black)' }}>
                    A PRIVATE HAIR STUDIO
                  </h2>
                  <h3 className="dust-heading 2xl:text-5xl xl:text-4xl lg:text-3xl tracking-narrow leading-tight" style={{ color: 'var(--dust-black)' }}>
                    BY LUCA TULLIO
                  </h3>
                </div>
                
                {/* Second text block - positioned lower */}
                <div className="max-w-xl mt-16 lg:mt-120 xl:mt-140 2xl:mt-160">
                  <p className="dust-mono text-base text-gray-700 tracking-wide leading-relaxed uppercase">
                    DUST WAS BORN FROM A DESIRE TO CREATE A PRIVATE AND PERSONALIZED SALON EXPERIENCE FOR EACH INDIVIDUAL CLIENT AND THE HAIR THEY WEAR.
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile/Tablet Layout - Stacked */}
            <div className="lg:hidden">
              {/* Hero Image - Full width on mobile */}
              <div className="relative aspect-[3/4]">
                <Image
                  src="/homepage_images/BannerLuca.webp"
                  alt="Luca Tullio - DUST Hair Studio"
                  fill
                  className="object-cover object-bottom"
                  priority
                />
              </div>

              {/* Text Content - Stacked */}
              <div className="space-y-8 mb-16 sm:mb-20 mt-6 sm:mt-8">
                <div className="space-y-1">
                  <h2 className="dust-heading text-2xl md:text-3xl tracking-narrow leading-tight" style={{ color: 'var(--dust-black)' }}>
                    A PRIVATE HAIR STUDIO
                  </h2>
                  <h3 className="dust-heading text-2xl md:text-3xl tracking-narrow leading-tight" style={{ color: 'var(--dust-black)' }}>
                    BY LUCA TULLIO
                  </h3>
                </div>
                
                <div className="mt-8 sm:mt-6 2xl:mt-[25rem]">
                  <p className="dust-mono text-sm md:text-base text-gray-700 tracking-wide leading-relaxed uppercase">
                    DUST WAS BORN FROM A DESIRE TO CREATE A PRIVATE AND PERSONALIZED SALON EXPERIENCE FOR EACH INDIVIDUAL CLIENT AND THE HAIR THEY WEAR.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Section */}
        <div className="py-40" style={{ backgroundColor: '#FAFAFA' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="dust-heading text-3xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl mb-8 tracking-tighter" style={{ color: 'var(--dust-black)' }}>
              BOOK AN APPOINTMENT
            </h2>
            
            <p className="dust-mono text-lg sm:text-base md:text-lg lg:text-xl xl:text-xl 2xl:text-2xl text-gray-700 mb-4 max-w-2xl mx-auto leading-relaxed">
              If this is your first time here, welcome. It&apos;s important we have enough time together so please make sure you choose the appropriate appointment option. If you have any questions please don&apos;t hesitate to reach out through my booking page.
            </p>
            
            <p className="dust-mono text-lg sm:text-base md:text-lg lg:text-xl xl:text-xl 2xl:text-2xl text-gray-700 mb-12 max-w-2xl mx-auto leading-relaxed">
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
                  // Filter services based on customer type restrictions
                  const filteredServices = services.filter(service => {
                    const isExistingCustomer = customer?.is_existing_customer || false
                    
                    // Show service if:
                    // 1. Available to both customer types (both flags true)
                    // 2. Available to existing customers AND user is existing customer
                    // 3. Available to new customers AND user is NOT existing customer
                    
                    const isAvailableToExisting = service.is_existing_customer
                    const isAvailableToNew = service.is_new_customer
                    
                    if (isAvailableToExisting && isAvailableToNew) {
                      // Available to both - always show
                      return true
                    } else if (isAvailableToExisting && isExistingCustomer) {
                      // Only for existing customers and user is existing
                      return true
                    } else if (isAvailableToNew && !isExistingCustomer) {
                      // Only for new customers and user is new
                      return true
                    } else {
                      // Not available to this customer type
                      return false
                    }
                  })

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
                            {isLoggedIn ? `${formattedPrice} • ${durationText}` : durationText}
                          </p>
                          <Button 
                            onClick={() => {
                              if (isLoggedIn) {
                                window.location.href = `/book?serviceId=${service.id}`
                              } else {
                                const redirectUrl = `/book?serviceId=${service.id}`
                                const loginUrl = `/login?redirect=${encodeURIComponent(redirectUrl)}`
                                console.log('🔍 Redirecting to login with URL:', loginUrl)
                                window.location.href = loginUrl
                              }
                            }}
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
        <div className="py-16" style={{ backgroundColor: '#FAFAFA' }}>
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-40 lg:gap-150 xl:gap-180 2xl:gap-250">
              {/* Contact Info */}
              <div className="text-center md:text-left">
                <h3 className="dust-heading text-2xl mb-6 tracking-tight" style={{ color: '#1C1C1D' }}>DUST</h3>
                <div className="dust-mono text-lg space-y-3 tracking-widest" style={{ color: '#1C1C1D' }}>
                  <p>1942 Riverside Dr.</p>
                  <p>Los Angeles, CA 90039</p>
                  <p>Luca@dusthairstudio.com</p>
                </div>
              </div>

              {/* Hours */}
              <div className="text-center md:text-left">
                <h3 className="dust-heading text-lg mb-6 tracking-tighter" style={{ color: '#1C1C1D' }}>HOURS</h3>
                <div className="dust-mono text-lg space-y-1 tracking-widest" style={{ color: '#1C1C1D' }}>
                  <p>Thursday-Sunday:</p>
                  <p>By Appointment</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-white py-16" style={{ backgroundColor: '#1C1C1D' }}>
          <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-40 lg:gap-150 xl:gap-180 2xl:gap-250 mb-16">
              {/* Subscribe */}
              <div className="text-center md:text-left">
                <h3 className="dust-heading text-lg text-white mb-4 tracking-wide">SUBSCRIBE</h3>
                <p className="dust-mono text-sm text-gray-300 mb-6">
                  Sign up with your email address to receive news and updates.
                </p>
                <div className="flex gap-3">
                  <Input 
                    type="email" 
                    placeholder="Email Address" 
                    className="flex-1 border-white text-gray-900 placeholder-gray-500"
                    style={{ backgroundColor: '#FAFAFA' }}
                  />
                  <Button className="text-gray-900 border border-white px-6" style={{ backgroundColor: '#FAFAFA' }}>
                    Sign Up
                  </Button>
                </div>
                <p className="dust-mono text-xs text-gray-400 mt-3">
                  We respect your privacy.
                </p>
              </div>

              {/* Follow */}
              <div className="text-center md:text-left">
                <h3 className="dust-heading text-lg text-white mb-4 tracking-wide">FOLLOW</h3>
                <a href="https://www.instagram.com/dust.hair.studio/" target="_blank" rel="noopener noreferrer" className="dust-mono text-sm text-white underline hover:no-underline">
                  INSTAGRAM
                </a>
              </div>
            </div>

            {/* Bottom Logo */}
            <div className="text-center overflow-hidden">
              <div className="dust-heading text-[9.5rem] xs:text-[10rem] sm:text-[12rem] md:text-[16rem] lg:text-[20rem] xl:text-[24rem] 2xl:text-[40rem]" style={{ color: '#FAFAFA' }}>
                DUST
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}