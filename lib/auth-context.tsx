'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from './supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    console.log('🔍 AuthContext: Starting auth setup')
    const supabase = createClient()
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔍 Initial session:', session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔍 Auth state changed:', event, session?.user?.email)
        setUser(session?.user ?? null)
        setLoading(false)
        setIsSigningOut(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    if (isSigningOut) {
      console.log('🔍 Sign out already in progress, skipping')
      return
    }
    
    console.log('🔍 Sign out called')
    setIsSigningOut(true)
    
    try {
      const supabase = createClient()
      console.log('🔍 Supabase client created, calling signOut...')
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('🔍 Supabase signOut error:', error)
        setIsSigningOut(false)
        return
      }
      
      console.log('🔍 Supabase signOut successful')
      
      // Force update the user state
      setUser(null)
      setLoading(false)
      setIsSigningOut(false)
      
    } catch (error) {
      console.error('🔍 Error during sign out:', error)
      setIsSigningOut(false)
    }
  }

  const value = {
    user,
    loading,
    signOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
