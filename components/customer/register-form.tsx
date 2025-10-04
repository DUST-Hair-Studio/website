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
    allowSmsNotifications: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
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

    // Basic phone number format validation
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
    if (!phoneRegex.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      setError('Please enter a valid phone number')
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
            allow_sms_notifications: formData.allowSmsNotifications
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
            is_existing_customer: false,
            allow_sms_notifications: formData.allowSmsNotifications
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
    } catch (error: any) {
      console.error('❌ Registration error:', error)
      if (error.message?.includes('timed out')) {
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
          Sign up to book appointments at DUST Hair Salon
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
          
          <Button type="submit" className="w-full" disabled={loading}>
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
