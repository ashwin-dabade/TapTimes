"use client"

interface TestResultsProps {
  results: {
    wpm: number
    accuracy: number
    time: number
  }
  article: {
    title: string
    content: string
  }
  onContinue: () => void
}

export default function TestResults({ results, article, onContinue }: TestResultsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Test Complete!</h2>
        <p className="text-muted-foreground">Article: {article.title}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground text-sm mb-2">Words Per Minute</p>
          <p className="text-4xl font-bold text-primary">{results.wpm}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground text-sm mb-2">Accuracy</p>
          <p className="text-4xl font-bold text-primary">{results.accuracy}%</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <p className="text-muted-foreground text-sm mb-2">Time</p>
          <p className="text-4xl font-bold text-primary">{results.time}s</p>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="w-full bg-primary text-primary-foreground py-4 rounded-lg font-medium text-lg hover:opacity-90 transition"
      >
        Try Another Test
      </button>
    </div>
  )
}
