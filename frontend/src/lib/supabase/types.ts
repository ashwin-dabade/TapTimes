export type Article = {
  id: string
  external_id: string | null
  title: string
  source: string
  url: string
  section: string | null
  summary: string | null
  words: string[]
  published_at: string | null
  created_at: string
  expires_at: string
}

export type TypingTest = {
  id: string
  user_id: string
  article_id: string | null
  topic: string | null
  article_title: string | null
  wpm: number
  accuracy: number
  time: number
  corrected_errors: number | null
  uncorrected_errors: number | null
  completed_at: string
}
