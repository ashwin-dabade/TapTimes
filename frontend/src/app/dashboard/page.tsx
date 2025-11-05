"use client"

import { useAuth } from "@/hooks/use-auth"
import { useEffect, useState } from "react"
import Header from "@/components/header"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface TestStats {
  totalTests: number
  averageWPM: number
  averageAccuracy: number
  totalTimeSpent: number
}

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<TestStats>({
    totalTests: 0,
    averageWPM: 0,
    averageAccuracy: 0,
    totalTimeSpent: 0,
  })
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/sign-in")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return

      try {
        setIsLoadingStats(true)
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        const response = await fetch('http://localhost:8000/api/tests/stats', {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        })

        if (!response.ok) {
          console.error('Error fetching stats')
          setIsLoadingStats(false)
          return
        }

        const statsData = await response.json()
        setStats({
          totalTests: statsData.total_tests,
          averageWPM: statsData.average_wpm,
          averageAccuracy: statsData.average_accuracy,
          totalTimeSpent: statsData.total_time,
        })
      } catch (err) {
        console.error('Error fetching stats:', err)
      } finally {
        setIsLoadingStats(false)
      }
    }

    fetchStats()
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Stats</h1>
          <p className="text-muted-foreground">All-time performance overview</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-2">Total Tests</p>
            <p className="text-3xl font-bold text-foreground">{stats.totalTests}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-2">Avg WPM</p>
            <p className="text-3xl font-bold text-primary">{stats.averageWPM}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-2">Avg Accuracy</p>
            <p className="text-3xl font-bold text-primary">{stats.averageAccuracy}%</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-muted-foreground text-sm mb-2">Total Time</p>
            <p className="text-3xl font-bold text-foreground">{stats.totalTimeSpent}s</p>
          </div>
        </div>

        <a
          href="/"
          className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 transition"
        >
          Practice More
        </a>
      </main>
    </div>
  )
}
