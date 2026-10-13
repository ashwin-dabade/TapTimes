"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import TestResults from "./test-results"
import { createClient } from "@/lib/supabase/client"
import type { Article } from "@/lib/supabase/types"
import { scoreTest, type Score } from "@/lib/scoring"

// Logged-out users' seen articles live in the browser.
const SEEN_KEY = "taptimes:seen-articles"
const MAX_LOCAL_SEEN = 300

function readLocalSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")
  } catch {
    return []
  }
}

function addLocalSeen(id: string) {
  try {
    const seen = readLocalSeen().filter((s) => s !== id)
    seen.push(id)
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-MAX_LOCAL_SEEN)))
  } catch {
    // Storage unavailable (private mode): repeats are possible but harmless.
  }
}

export default function TypingPractice() {
  const { user, loading: authLoading } = useAuth()
  const supabase = useMemo(() => createClient(), [])

  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [caughtUp, setCaughtUp] = useState(false)

  const [typed, setTyped] = useState("")
  const [startTime, setStartTime] = useState<number | null>(null)
  const [wrongKeystrokes, setWrongKeystrokes] = useState(0)
  const [results, setResults] = useState<Score | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const content = useMemo(() => article?.words.join(" ") ?? "", [article])

  const fetchArticle = useCallback(
    async (includeSeen = false) => {
      setLoading(true)
      setError(null)
      setCaughtUp(false)
      try {
        const exclude = [...(user ? [] : readLocalSeen()), ...(article ? [article.id] : [])]
        const { data, error } = await supabase.rpc("get_next_article", {
          exclude,
          include_seen: includeSeen,
        })
        if (error) throw error

        const next = (data as Article[] | null)?.[0]
        if (!next) {
          setArticle(null)
          setCaughtUp(true)
          return
        }

        setArticle(next)
        if (user) {
          await supabase
            .from("user_article_views")
            .upsert({ user_id: user.id, article_id: next.id }, { ignoreDuplicates: true })
        } else {
          addLocalSeen(next.id)
        }
      } catch (err) {
        console.error("Error loading article:", err)
        setError("Failed to load article")
      } finally {
        setLoading(false)
      }
    },
    [supabase, user, article]
  )

  // Wait for the session check so seen-tracking uses the right user.
  const initialFetchDone = useRef(false)
  useEffect(() => {
    if (authLoading || initialFetchDone.current) return
    initialFetchDone.current = true
    fetchArticle()
  }, [authLoading, fetchArticle])

  useEffect(() => {
    setTyped("")
    setStartTime(null)
    setWrongKeystrokes(0)
    setResults(null)
    containerRef.current?.focus()
  }, [article])

  const saveTest = useCallback(
    async (score: Score) => {
      if (!user || !article) return
      const { error } = await supabase.from("typing_tests").insert({
        user_id: user.id,
        article_id: article.id,
        topic: article.section,
        article_title: article.title,
        wpm: score.wpm,
        accuracy: score.accuracy,
        time: score.time,
        corrected_errors: score.correctedErrors,
        uncorrected_errors: score.uncorrectedErrors,
      })
      if (error) console.error("Failed to save test results:", error)
    },
    [supabase, user, article]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (results || !content) return

      if (e.key === "Backspace") {
        e.preventDefault()
        setTyped((prev) => prev.slice(0, -1))
        return
      }

      // Ignore modifier combos and special keys (Shift, Tab, arrows, ...)
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return
      e.preventDefault()

      const position = typed.length
      if (position >= content.length) return

      const now = Date.now()
      const start = startTime ?? now
      if (startTime === null) setStartTime(now)

      const isWrong = e.key !== content[position]
      const newWrong = wrongKeystrokes + (isWrong ? 1 : 0)
      if (isWrong) setWrongKeystrokes(newWrong)

      const newTyped = typed + e.key
      setTyped(newTyped)

      // Finish when the cursor reaches the end; unfixed mistakes cost extra.
      if (newTyped.length === content.length) {
        const score = scoreTest(content, newTyped, newWrong, now - start)
        setResults(score)
        saveTest(score)
      }
    }

    const container = containerRef.current
    container?.addEventListener("keydown", handleKeyDown)
    return () => container?.removeEventListener("keydown", handleKeyDown)
  }, [typed, startTime, wrongKeystrokes, results, content, saveTest])

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

  if (caughtUp) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-foreground text-lg font-medium">You&apos;re all caught up!</p>
          <p className="text-muted-foreground">New articles arrive every night.</p>
          <button
            onClick={() => fetchArticle(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Practice a previous article
          </button>
        </div>
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Failed to load article"}</p>
          <button
            onClick={() => fetchArticle()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (results) {
    return <TestResults results={results} article={{ title: article.title }} onContinue={() => fetchArticle()} />
  }

  const progress = (typed.length / content.length) * 100
  let currentErrors = 0
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== content[i]) currentErrors++
  }

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground mb-2">{article.title}</h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                {article.source}
                {article.section ? ` · ${article.section}` : ""}
              </span>
              <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Read full article →
              </a>
            </div>
          </div>
          <button
            onClick={() => fetchArticle()}
            className="px-4 py-2 bg-muted text-foreground hover:bg-muted/80 rounded-lg font-medium transition whitespace-nowrap"
          >
            Skip
          </button>
        </div>
        <p className="text-muted-foreground text-sm">
          Start typing. Click to focus if needed. You can backspace to fix mistakes, but every mistake costs accuracy,
          and unfixed ones cost double.
        </p>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        className="bg-card border border-border rounded-lg p-6 focus:outline-none focus:ring-2 focus:ring-primary cursor-text"
      >
        <div className="mb-4 bg-muted rounded-lg p-4 min-h-32 max-h-64 overflow-y-auto">
          <p className="text-lg leading-relaxed text-justify font-mono">
            {content.split("").map((char, index) => {
              let className = "text-muted-foreground"
              if (index < typed.length) {
                className =
                  typed[index] === char ? "text-green-500 font-semibold" : "text-red-500 font-semibold bg-red-500/20"
              } else if (index === typed.length) {
                className = "bg-primary/50 animate-pulse text-foreground font-semibold"
              }
              return (
                <span key={index} className={className}>
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
          Mistakes: {wrongKeystrokes} ({currentErrors} unfixed)
        </span>
        <span>
          {typed.length} / {content.length} characters
        </span>
      </div>
    </div>
  )
}
