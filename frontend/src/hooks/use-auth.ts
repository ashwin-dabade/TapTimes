"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"

export interface AppUser {
  id: string
  username: string
  email: string
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading] = useState(false) // Always false - don't block page load
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true

    // Check for existing session in background (non-blocking)
    const getUser = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error || !session?.user || !mounted) {
          return
        }

        // Try to fetch user profile from your users table (optional)
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('username')
            .eq('id', session.user.id)
            .single()

          if (mounted) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              username: profile?.username || session.user.email?.split('@')[0] || 'user'
            })
          }
        } catch (profileError) {
          // If users table doesn't exist or query fails, just use email
          if (mounted) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              username: session.user.email?.split('@')[0] || 'user'
            })
          }
        }
      } catch (error) {
        // Silently fail - user just stays logged out
        console.log('[useAuth] Could not check session:', error)
      }
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if (session?.user) {
        // Try to get profile, but fallback to email if it fails
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('username')
            .eq('id', session.user.id)
            .single()

          if (mounted) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              username: profile?.username || session.user.email?.split('@')[0] || 'user'
            })
          }
        } catch {
          if (mounted) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              username: session.user.email?.split('@')[0] || 'user'
            })
          }
        }
      } else {
        if (mounted) {
          setUser(null)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, username: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username
        }
      }
    })

    if (error) throw error

    // Create user profile in users table
    if (data.user) {
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          username,
          email
        })

      if (profileError) {
        console.error('Error creating user profile:', profileError)
      }
    }

    return data
  }

  const signIn = async (usernameOrEmail: string, password: string) => {
    // Check if input is email or username
    const isEmail = usernameOrEmail.includes('@')
    
    let email = usernameOrEmail
    
    // If username provided, fetch email from database
    if (!isEmail) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('username', usernameOrEmail)
        .single()

      if (userError || !userData) {
        throw new Error('Invalid username or password')
      }
      
      email = userData.email
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error

    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return { user, loading, signUp, signIn, signOut }
}