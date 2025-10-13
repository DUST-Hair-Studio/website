'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

export function RegisterForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    birthMonth: '',
    birthDay: '',
    allowSmsNotifications: false,
    allowMarketingEmails: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = 'checked' in e.target ? e.target.checked : false
    
    // Format phone number as user types
    if (name === 'phone') {
      const formattedPhone = formatPhoneNumber(value)
      setFormData(prev => ({
        ...prev,
        [name]: formattedPhone
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }))
    }
  }

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const phoneNumber = value.replace(/\D/g, '')
    
    // Don't format if empty
    if (!phoneNumber) return ''
    
    // Format based on length
    if (phoneNumber.length <= 3) {
      return `(${phoneNumber}`
    } else if (phoneNumber.length <= 6) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
    } else {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    // Validate password strength
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    // Validate phone number
    if (!formData.phone || formData.phone.trim().length === 0) {
      setError('Phone number is required')
      setLoading(false)
      return
    }

    // Basic phone number format validation (check for 10 digits after formatting)
    const phoneDigits = formData.phone.replace(/\D/g, '')
    if (phoneDigits.length !== 10) {
      setError('Please enter a valid 10-digit phone number')
      setLoading(false)
      return
    }

    try {
      console.log('🔍 Starting Supabase Auth signup...')
      
      // Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            phone: formData.phone,
            birth_month: formData.birthMonth,
            birth_day: formData.birthDay,
            allow_sms_notifications: formData.allowSmsNotifications,
            allow_marketing_emails: formData.allowMarketingEmails
          }
        }
      })

      console.log('🔍 Supabase Auth response:', { authData, authError })

      if (authError) {
        setError(authError.message)
      } else if (authData.user) {
        console.log('✅ Auth user created:', authData.user.id)
        
        // Create customer record linked to auth user
        console.log('🔍 Creating customer record for user:', authData.user.id)
        
        const { data: customerData, error: customerError } = await supabase
          .from('customers')
          .insert({
            auth_user_id: authData.user.id,
            email: formData.email,
            name: formData.name,
            phone: formData.phone,
            birth_month: formData.birthMonth,
            birth_day: formData.birthDay,
            is_existing_customer: false,
            allow_sms_notifications: formData.allowSmsNotifications,
            allow_marketing_emails: formData.allowMarketingEmails
          })
          .select()

        if (customerError) {
          console.error('❌ Error creating customer record:', customerError)
          setError(`Account created but customer record failed: ${customerError.message}`)
        } else {
          console.log('✅ Customer record created successfully:', customerData)
          setSuccess(true)
        }
      }
    } catch (error: unknown) {
      console.error('❌ Registration error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('timed out')) {
        setError('Connection timed out. Please check your internet connection and try again.')
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="text-green-600 text-6xl">✓</div>
            <h2 className="text-2xl font-bold">Account Created!</h2>
            <p className="text-gray-600">
              Your account has been created successfully. You can now book appointments with existing customer pricing.
            </p>
            <div className="space-y-2">
              <Button onClick={() => router.push('/')} className="w-full">
                Go to Home
              </Button>
              <Button onClick={() => router.push('/login')} variant="outline" className="w-full">
                Sign In
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Sign up to book appointments at DUST Studio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Birth Date</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <select
                  id="birthMonth"
                  name="birthMonth"
                  value={formData.birthMonth}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Month</option>
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>
              </div>
              <div>
                <select
                  id="birthDay"
                  name="birthDay"
                  value={formData.birthDay}
                  onChange={handleInputChange}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Day</option>
                  {Array.from({ length: 31 }, (_, i) => {
                    const day = (i + 1).toString().padStart(2, '0');
                    return (
                      <option key={day} value={day}>
                        {i + 1}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>
          
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  placeholder="(555) 123-4567"
                />
              </div>
          
          <div className="flex items-start space-x-3">
            <input
              id="allowSmsNotifications"
              name="allowSmsNotifications"
              type="checkbox"
              checked={formData.allowSmsNotifications}
              onChange={handleInputChange}
              disabled={loading}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div className="text-sm">
              <Label htmlFor="allowSmsNotifications" className="font-normal cursor-pointer">
                I agree to receive appointment reminders and updates via SMS
              </Label>
              <p className="text-gray-500 mt-1">
                You can opt out at any time. Standard message rates may apply.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <input
              id="allowMarketingEmails"
              name="allowMarketingEmails"
              type="checkbox"
              checked={formData.allowMarketingEmails}
              onChange={handleInputChange}
              disabled={loading}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div className="text-sm">
              <Label htmlFor="allowMarketingEmails" className="font-normal cursor-pointer">
                Email me updates about special offers and studio news
              </Label>
              <p className="text-gray-500 mt-1">
                No spam, just the good stuff. Unsubscribe anytime.
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              disabled={loading}
              minLength={6}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              disabled={loading}
              minLength={6}
            />
          </div>
          
          <Button 
            type="submit" 
            variant="outline"
            className="w-full bg-white border border-black hover:bg-gray-50" 
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>
        
        <div className="mt-4 text-center text-sm">
          <p>
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
