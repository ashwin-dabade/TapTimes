"use client"

interface TopicSelectorProps {
  selectedTopic: string
  onSelect: (topic: string) => void
}

const topics = [
  { id: "technology", label: "Technology" },
  { id: "business", label: "Business" },
  { id: "science", label: "Science" },
  { id: "health", label: "Health" },
  { id: "sports", label: "Sports" },
  { id: "politics", label: "Politics" },
  { id: "entertainment", label: "Entertainment" },
  { id: "world", label: "World" },
]

export default function TopicSelector({ selectedTopic, onSelect }: TopicSelectorProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-4">Select a Topic</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => onSelect(topic.id)}
            className={`p-4 rounded-lg border-2 font-medium transition ${
              selectedTopic === topic.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary"
            }`}
          >
            {topic.label}
          </button>
        ))}
      </div>
    </div>
  )
}
