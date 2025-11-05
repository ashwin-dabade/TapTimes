"use client"

import { useAuth } from "@/hooks/use-auth"
import Header from "@/components/header"
import TypingPractice from "@/components/typing-practice"

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Tap Times</h1>
            <p className="text-lg text-muted-foreground">
              {user
                ? "Welcome back! Practice typing with real news articles."
                : "Practice typing with real news articles. Sign in to save your results."}
            </p>
          </div>
          <TypingPractice />
        </div>
      </main>
    </div>
  )
}
