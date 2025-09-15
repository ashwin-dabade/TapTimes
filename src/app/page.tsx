'use client';

import { useState, useEffect, useRef } from 'react';

// Fallback word list for when news API fails
const FALLBACK_WORDS = [
  'the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog', 'hello', 'world', 'type', 'fast', 'practice', 'keyboard', 'speed', 'accuracy', 'test', 'random', 'words', 'simple', 'fun', 'challenge', 'improve', 'skills', 'focus', 'learn', 'repeat', 'try', 'again', 'score', 'result',
];

function getRandomWords(count: number) {
  const words = [];
  for (let i = 0; i < count; i++) {
    words.push(FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)]);
  }
  return words;
}

interface NewsArticle {
  id?: string;
  title: string;
  source: string;
  words: string[];
  url: string;
}

export default function Home() {
  const [words, setWords] = useState<string[]>(() => getRandomWords(30));
  const [userInput, setUserInput] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [time, setTime] = useState(30);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentArticle, setCurrentArticle] = useState<NewsArticle | null>(null);
  const [viewedArticleIds, setViewedArticleIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load viewed article IDs from session storage on component mount
  useEffect(() => {
    const stored = sessionStorage.getItem('viewedArticleIds');
    if (stored) {
      setViewedArticleIds(JSON.parse(stored));
    }
  }, []);

  // Start timer on first input
  useEffect(() => {
    if (!isActive && userInput.length > 0 && !finished) {
      setIsActive(true);
    }
  }, [userInput, isActive, finished]);

  // Timer effect
  useEffect(() => {
    if (!isActive) return;
    if (time === 0) {
      setIsActive(false);
      setFinished(true);
      calculateResults();
      return;
    }
    const interval = setInterval(() => {
      setTime((t) => t - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, time]);

  // Calculate WPM and accuracy
  const calculateResults = () => {
    const inputWords = userInput.trim().split(/\s+/);
    let correctWords = 0;
    for (let i = 0; i < inputWords.length; i++) {
      if (inputWords[i] === words[i]) correctWords++;
    }
    const wpm = Math.round((inputWords.length / 0.5) / 60 * 30); // 30s test
    setWpm(wpm);
    const totalChars = userInput.replace(/\s/g, '').length;
    let correctChars = 0;
    for (let i = 0; i < userInput.length; i++) {
      if (userInput[i] === (words.join(' ') + ' ')[i]) correctChars++;
    }
    setAccuracy(totalChars === 0 ? 100 : Math.round((correctChars / totalChars) * 100));
  };

  // Handle input
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (finished) return;
    setUserInput(e.target.value);
  };

  // Fetch news article
  const fetchNewsArticle = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Include viewed article IDs in the request
      const viewedParam = viewedArticleIds.length > 0 ? `?viewed=${viewedArticleIds.join(',')}` : '';
      const response = await fetch(`/api/news${viewedParam}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch news article');
      }
      
      setCurrentArticle(data);
      setWords(data.words);
      
      // Add this article ID to viewed articles if it has an ID
      if (data.id) {
        const newViewedIds = [...viewedArticleIds, data.id];
        setViewedArticleIds(newViewedIds);
        sessionStorage.setItem('viewedArticleIds', JSON.stringify(newViewedIds));
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch news article');
      // Fallback to random words
      setWords(getRandomWords(30));
      setCurrentArticle(null);
    } finally {
      setLoading(false);
    }
  };

  // Restart test
  const handleRestart = () => {
    setWords(getRandomWords(30));
    setUserInput('');
    setIsActive(false);
    setTime(30);
    setWpm(0);
    setAccuracy(100);
    setFinished(false);
    setError(null);
    setCurrentArticle(null);
    if (inputRef.current) inputRef.current.focus();
  };

  // Load new article
  const handleNewArticle = () => {
    fetchNewsArticle();
    setUserInput('');
    setIsActive(false);
    setTime(30);
    setWpm(0);
    setAccuracy(100);
    setFinished(false);
    setError(null);
    if (inputRef.current) inputRef.current.focus();
  };


  // Render the words with highlighting
  const renderWords = () => {
    const allChars = words.join(' ') + ' ';
    return (
      <div className="text-lg font-mono mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded min-h-[80px]">
        {allChars.split('').map((char, idx) => {
          let className = '';
          if (userInput.length > idx) {
            className = userInput[idx] === char ? 'text-green-600' : 'text-red-500';
          } else if (userInput.length === idx) {
            className = 'bg-yellow-200'; // caret position
          }
          return (
            <span key={idx} className={className}>{char}</span>
          );
        })}
      </div>
    );
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">News Typing App</h1>
        
        {/* Statistics */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Articles viewed this session: {viewedArticleIds.length}
          </p>
        </div>
        
        {/* Article Info */}
        {currentArticle && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h2 className="font-semibold text-lg mb-2">{currentArticle.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Source: {currentArticle.source}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">
              {error}
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading news article...</p>
          </div>
        )}

        {renderWords()}
        <input
          ref={inputRef}
          className="w-full p-2 border rounded font-mono text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={userInput}
          onChange={handleInput}
          disabled={finished || time === 0 || loading}
          placeholder="Start typing to begin..."
          autoFocus
        />
        <div className="flex justify-between items-center mb-4">
          <div>Time: {time}s</div>
          <div>WPM: {wpm}</div>
          <div>Accuracy: {accuracy}%</div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-4 justify-center mt-4">
          <button 
            className="button" 
            onClick={handleNewArticle}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'New Article'}
          </button>
          {finished && (
            <button className="button" onClick={handleRestart}>
              Restart
            </button>
          )}
        </div>

        {/* Article Link */}
        {currentArticle && currentArticle.url && (
          <div className="mt-4 text-center">
            <a 
              href={currentArticle.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              Read full article →
            </a>
          </div>
        )}
      </div>
    </main>
  );
} 