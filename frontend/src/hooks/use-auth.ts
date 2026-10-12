"use client"

import { useEffect, useState, useMemo } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export interface AppUser {
  id: string
  username: string
  email: string
}

function toAppUser(user: User): AppUser {
  return {
    id: user.id,
    email: user.email || "",
    username: user.user_metadata?.username || user.email?.split("@")[0] || "user",
  }
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  // True until the initial session check finishes, so pages don't redirect early.
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (mounted) setUser(session?.user ? toAppUser(session.user) : null)
      })
      .catch((error) => console.log("[useAuth] Could not check session:", error))
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ? toAppUser(session.user) : null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const signUp = async (email: string, username: string, password: string) => {
    const { data: available, error: checkError } = await supabase.rpc("username_available", {
      name: username,
    })
    if (checkError) throw checkError
    if (!available) throw new Error("That username is taken")

    // The users profile row is created by a database trigger from this metadata.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    return data
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return { user, loading, signUp, signIn, signOut }
}
