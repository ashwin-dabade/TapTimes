export type Profile = {
  id: string
  username: string | null
  created_at: string
}

export type TypingTest = {
  id: string
  user_id: string
  article_id: string | null
  wpm: number
  accuracy: number
  time_spent: number
  completed_at: string
}