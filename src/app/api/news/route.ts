import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const API_KEY = process.env.GUARDIAN_API_KEY;
  
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Guardian API key not configured. Please add GUARDIAN_API_KEY to your .env.local file.' },
      { status: 500 }
    );
  }

  try {
    // Fetch news articles from Guardian API
    const response = await fetch(
      `https://content.guardianapis.com/search?api-key=${API_KEY}&show-fields=body,headline,trailText&page-size=20&order-by=newest`,
      {
        headers: {
          'User-Agent': 'News-Typing-App/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Guardian API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.response?.status !== 'ok' || !data.response?.results || data.response.results.length === 0) {
      throw new Error('No articles found');
    }

    // Get a random article
    const randomArticle = data.response.results[Math.floor(Math.random() * data.response.results.length)];
    
    // Extract content from Guardian API response
    let content = '';
    
    // Try to get body content first (full article text)
    if (randomArticle.fields?.body) {
      content = randomArticle.fields.body;
    } 
    // Fallback to trail text (summary)
    else if (randomArticle.fields?.trailText) {
      content = randomArticle.fields.trailText;
    }
    // Last resort: use headline
    else if (randomArticle.fields?.headline) {
      content = randomArticle.fields.headline;
    }
    
    // Clean up the content: remove HTML tags, extra whitespace, and limit length
    const cleanContent = content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .substring(0, 1000); // Increased to 1000 characters for more content

    // Split into words and filter out empty strings
    const words = cleanContent
      .split(' ')
      .filter((word: string) => word.length > 0)
      .slice(0, 80); // Increased to 80 words for longer typing tests

    if (words.length === 0) {
      throw new Error('No valid words found in article');
    }

    return NextResponse.json({
      title: randomArticle.fields?.headline || randomArticle.webTitle || 'Untitled',
      source: 'The Guardian',
      words: words,
      url: randomArticle.webUrl,
    });

  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch news article',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
