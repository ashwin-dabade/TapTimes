'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fetchNews } from '@/lib/api';
import Auth from '@/components/Auth';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  // Typing state
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

  // Check user session
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setAuthLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setShowAuthModal(false); // Close modal on successful auth
      router.refresh();
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

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
    const calculatedWpm = Math.round((inputWords.length / 0.5) / 60 * 30);
    setWpm(calculatedWpm);
    const totalChars = userInput.replace(/\s/g, '').length;
    let correctChars = 0;
    for (let i = 0; i < userInput.length; i++) {
      if (userInput[i] === (words.join(' ') + ' ')[i]) correctChars++;
    }
    const calculatedAccuracy = totalChars === 0 ? 100 : Math.round((correctChars / totalChars) * 100);
    setAccuracy(calculatedAccuracy);
  };

  // Save test results when finished (only for logged-in users)
  const saveTestResult = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.from('typing_tests').insert({
        user_id: user.id,
        article_id: currentArticle?.id || null,
        wpm: wpm,
        accuracy: accuracy,
        time_spent: 30 - time,
      });

      if (error) throw error;
      console.log('Test result saved!');
    } catch (error) {
      console.error('Error saving test result:', error);
    }
  };

  // Call saveTestResult when test finishes
  useEffect(() => {
    if (finished && user && wpm > 0) {
      saveTestResult();
    }
  }, [finished, user, wpm]);

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
      const data = await fetchNews(viewedArticleIds);

      setCurrentArticle(data);
      setWords(data.words);

      if (data.id) {
        const newViewedIds = [...viewedArticleIds, data.id];
        setViewedArticleIds(newViewedIds);
        sessionStorage.setItem('viewedArticleIds', JSON.stringify(newViewedIds));
      }
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch news article');
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

  // Handle sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
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
            className = 'bg-yellow-200 dark:bg-yellow-600';
          }
          return (
            <span key={idx} className={className}>{char}</span>
          );
        })}
      </div>
    );
  };

  // Loading state for auth
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Main typing interface (always shown)
  return (
    <>
      <main className="min-h-screen p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">News Typing App</h1>
            <div className="flex gap-4">
              {user ? (
                <>
                  <Link 
                    href="/stats"
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    View Stats
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Sign In / Sign Up
                </button>
              )}
            </div>
          </div>
          
          {/* Guest Mode Info Banner (only show if not logged in) */}
          {!user && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                💡 <strong>Try it out!</strong> You're using the app as a guest. 
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="ml-2 underline hover:text-blue-600 dark:hover:text-blue-300"
                >
                  Sign in to save your progress
                </button>
              </p>
            </div>
          )}
          
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
            className="w-full p-2 border rounded font-mono text-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-700 dark:border-gray-600"
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
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" 
              onClick={handleNewArticle}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'New Article'}
            </button>
            <button 
              className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              onClick={handleRestart}
            >
              Restart
            </button>
          </div>

          {/* Results Display */}
          {finished && (
            <div className="mt-8 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <h2 className="text-2xl font-bold mb-4">Test Complete! ✅</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">WPM</p>
                  <p className="text-3xl font-bold">{wpm}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Accuracy</p>
                  <p className="text-3xl font-bold">{accuracy}%</p>
                </div>
              </div>
              
              {/* Show different messages based on user status */}
              {!user ? (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                    💡 Want to track your progress over time?
                  </p>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create an Account
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-4">
                  ✅ Result saved to your account!
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg max-w-md w-full relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
            >
              ×
            </button>
            <div className="p-6">
              <Auth />
            </div>
          </div>
        </div>
      )}
    </>
  );
}