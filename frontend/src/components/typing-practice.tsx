"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import TestResults from "./test-results"
import { createClient } from "@/lib/supabase/client"

interface Article {
  id: string
  title: string
  source: string
  content: string
  url: string
}

export default function TypingPractice() {
  const { user } = useAuth()
  const [isComplete, setIsComplete] = useState(false)
  const [typed, setTyped] = useState("")
  const [startTime, setStartTime] = useState<number | null>(null)
  const [results, setResults] = useState<{
    wpm: number
    accuracy: number
    time: number
  } | null>(null)
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewedArticles, setViewedArticles] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Fetch article from backend
  const fetchArticle = async () => {
    try {
      setLoading(true)
      setError(null)

      const viewedParam = viewedArticles.length > 0 ? `?viewed=${viewedArticles.join(',')}` : ''
      const response = await fetch(`http://localhost:8000/api/news${viewedParam}`)

      if (!response.ok) {
        throw new Error('Failed to fetch article')
      }

      const data = await response.json()

      // Convert words array to content string
      const content = data.words.join(' ')

      const article: Article = {
        id: data.id,
        title: data.title,
        source: data.source,
        content: content,
        url: data.url,
      }

      setCurrentArticle(article)
      setViewedArticles(prev => [...prev, data.id])
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article')
      setLoading(false)
    }
  }

  // Fetch initial article on mount
  useEffect(() => {
    fetchArticle()
  }, [])

  useEffect(() => {
    setTyped("")
    setStartTime(null)
    containerRef.current?.focus()
  }, [currentArticle])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComplete || !currentArticle) return

      // Allow special keys like backspace
      if (e.key === "Backspace") {
        e.preventDefault()
        setTyped((prev) => prev.slice(0, -1))
        return
      }

      // Ignore modifier keys and special keys
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) {
        return
      }

      e.preventDefault()

      const newTyped = typed + e.key
      setTyped(newTyped)

      // Start timer on first character
      if (newTyped.length === 1 && !startTime) {
        setStartTime(Date.now())
      }

      // Check if test is complete
      if (newTyped === currentArticle.content) {
        const endTime = Date.now()
        const timeSeconds = (endTime - (startTime || endTime)) / 1000
        const words = currentArticle.content.split(" ").length
        const wpm = Math.round((words / timeSeconds) * 60)

        // Calculate accuracy
        let correctChars = 0
        for (let i = 0; i < newTyped.length; i++) {
          if (newTyped[i] === currentArticle.content[i]) correctChars++
        }
        const accuracy = Math.round((correctChars / currentArticle.content.length) * 100)

        setResults({
          wpm,
          accuracy,
          time: Math.round(timeSeconds),
        })
        setIsComplete(true)

        // Save test results via backend API if user is logged in
        if (user) {
          const saveTest = async () => {
            try {
              const supabase = createClient()
              const { data: { session } } = await supabase.auth.getSession()

              const response = await fetch('http://localhost:8000/api/tests', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                  topic: currentArticle.source,
                  article_title: currentArticle.title,
                  wpm,
                  accuracy,
                  time: Math.round(timeSeconds),
                })
              })

              if (!response.ok) {
                console.error('Failed to save test results')
              }
            } catch (err) {
              console.error('Error saving test:', err)
            }
          }
          saveTest()
        }
      }
    }

    const container = containerRef.current
    container?.addEventListener("keydown", handleKeyDown)
    return () => container?.removeEventListener("keydown", handleKeyDown)
  }, [typed, startTime, isComplete, currentArticle, user])

  const handleSkip = () => {
    setIsComplete(false)
    setResults(null)
    setTyped("")
    setStartTime(null)
    fetchArticle()
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading article...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !currentArticle) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Failed to load article'}</p>
          <button
            onClick={fetchArticle}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (isComplete && results) {
    return <TestResults results={results} article={{ title: currentArticle.title, content: currentArticle.content }} onContinue={handleSkip} />
  }

  const progress = (typed.length / currentArticle.content.length) * 100

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-2">{currentArticle.title}</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{currentArticle.source}</span>
              <a
                href={currentArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Read full article →
              </a>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="px-4 py-2 bg-muted text-foreground hover:bg-muted/80 rounded-lg font-medium transition whitespace-nowrap"
          >
            Skip
          </button>
        </div>
        <p className="text-muted-foreground text-sm">Start typing. Click to focus if needed.</p>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        className="bg-card border border-border rounded-lg p-6 focus:outline-none focus:ring-2 focus:ring-primary cursor-text"
      >
        <div className="mb-4 bg-muted rounded-lg p-4 min-h-32 max-h-64 overflow-y-auto">
          <p className="text-lg leading-relaxed text-justify font-mono">
            {currentArticle.content.split("").map((char: string, index: number) => {
              let bgClass = ""
              let textClass = "text-muted-foreground"

              if (index < typed.length) {
                // Typed characters - green for correct, red for incorrect
                textClass =
                  typed[index] === char ? "text-green-500 font-semibold" : "text-red-500 font-semibold bg-red-500/20"
              } else if (index === typed.length) {
                // Current position - animated cursor
                bgClass = "bg-primary/50 animate-pulse"
                textClass = "text-foreground font-semibold"
              } else {
                // Untyped characters
                textClass = "text-muted-foreground"
              }

              return (
                <span key={index} className={`${bgClass} ${textClass}`}>
                  {char}
                </span>
              )
            })}
          </p>
        </div>

        <div className="mb-4 bg-muted rounded h-2 overflow-hidden">
          <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>{Math.round(progress)}% complete</span>
        <span>
          {typed.length} / {currentArticle.content.length} characters
        </span>
      </div>
    </div>
  )
}
