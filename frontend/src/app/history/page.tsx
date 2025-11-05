"use client"

import { useAuth } from "@/hooks/use-auth"
import { useEffect, useState } from "react"
import Header from "@/components/header"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface Test {
  id: string
  user_id: string
  topic: string
  article_title: string
  wpm: number
  accuracy: number
  time: number
  completed_at: string
}

export default function History() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [isLoadingTests, setIsLoadingTests] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/sign-in")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchTests = async () => {
      if (!user) return

      try {
        setIsLoadingTests(true)
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        const response = await fetch('http://localhost:8000/api/tests/history', {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        })

        if (!response.ok) {
          console.error('Error fetching tests')
          setIsLoadingTests(false)
          return
        }

        const data = await response.json()
        setTests(data.tests || [])
      } catch (err) {
        console.error('Error fetching tests:', err)
      } finally {
        setIsLoadingTests(false)
      }
    }

    fetchTests()
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="flex items-center justify-center min-h-[calc(100vh-60px)]">
          <div className="text-muted-foreground">Loading...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Test History</h1>
          <p className="text-muted-foreground">Review your past typing tests</p>
        </div>

        {tests.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground mb-4">No tests completed yet</p>
            <a
              href="/"
              className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition"
            >
              Start Your First Test
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {tests.map((test) => (
              <div key={test.id} className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{test.article_title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(test.completed_at).toLocaleDateString()} • <span className="capitalize">{test.topic}</span>
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">WPM</p>
                    <p className="text-2xl font-bold text-primary">{test.wpm}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Accuracy</p>
                    <p className="text-2xl font-bold text-primary">{test.accuracy}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Time</p>
                    <p className="text-2xl font-bold text-foreground">{test.time}s</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
