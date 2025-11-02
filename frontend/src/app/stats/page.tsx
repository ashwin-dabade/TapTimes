'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TypingTest } from '@/lib/supabase/types'
import Link from 'next/link'

export default function StatsPage() {
  const [tests, setTests] = useState<TypingTest[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchTests()
  }, [])

  const fetchTests = async () => {
    try {
      const { data, error } = await supabase
        .from('typing_tests')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setTests(data || [])
    } catch (error) {
      console.error('Error fetching tests:', error)
    } finally {
      setLoading(false)
    }
  }

  const avgWpm = tests.length > 0 
    ? Math.round(tests.reduce((sum, t) => sum + t.wpm, 0) / tests.length)
    : 0

  const avgAccuracy = tests.length > 0
    ? Math.round(tests.reduce((sum, t) => sum + t.accuracy, 0) / tests.length)
    : 0

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Your Stats</h1>
          <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Back to Typing
          </Link>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Average WPM</h3>
            <p className="text-4xl font-bold">{avgWpm}</p>
          </div>
          <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Average Accuracy</h3>
            <p className="text-4xl font-bold">{avgAccuracy}%</p>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-2xl font-bold mb-2">Total Tests</h2>
          <p className="text-xl">{tests.length} tests completed</p>
        </div>

        <h2 className="text-2xl font-bold mb-4">Recent Tests</h2>
        {loading ? (
          <p>Loading...</p>
        ) : tests.length === 0 ? (
          <div className="p-8 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
            <p className="text-gray-600 dark:text-gray-400">No tests yet. Complete a typing test to see your stats!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tests.map((test) => (
              <div key={test.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg flex justify-between items-center">
                <span className="text-sm">
                  {new Date(test.completed_at).toLocaleDateString()} at {new Date(test.completed_at).toLocaleTimeString()}
                </span>
                <div className="flex gap-6">
                  <span className="font-semibold">{test.wpm} WPM</span>
                  <span className="font-semibold">{test.accuracy}% Accuracy</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}