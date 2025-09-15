import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const API_KEY = process.env.GUARDIAN_API_KEY;
  
  if (!API_KEY) {
    return NextResponse.json(
      { error: 'Guardian API key not configured. Please add GUARDIAN_API_KEY to your .env.local file.' },
      { status: 500 }
    );
  }

  try {
    // Get viewed article IDs from query parameters (sent by frontend)
    const url = new URL(request.url);
    const viewedIds = url.searchParams.get('viewed')?.split(',') || [];
    
    // First, try to get articles from the database that haven't been viewed
    let query = supabase
      .from('articles')
      .select('*')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    // If we have viewed IDs, exclude them
    if (viewedIds.length > 0) {
      query = query.not('id', 'in', `(${viewedIds.join(',')})`);
    }

    const { data: existingArticles, error: dbError } = await query;

    if (!dbError && existingArticles && existingArticles.length > 0) {
      // Return a random article from the database that hasn't been viewed
      const randomArticle = existingArticles[Math.floor(Math.random() * existingArticles.length)];
      return NextResponse.json({
        id: randomArticle.id,
        title: randomArticle.title,
        source: randomArticle.source,
        words: randomArticle.words,
        url: randomArticle.url,
      });
    }

    // If no unviewed articles in database, fetch from Guardian API
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

    // Find a unique article that's not already in the database
    let selectedArticle = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!selectedArticle && attempts < maxAttempts) {
      const randomArticle = data.response.results[Math.floor(Math.random() * data.response.results.length)];
      
      // Check if this article URL already exists in database
      const { data: existingArticle } = await supabase
        .from('articles')
        .select('id')
        .eq('url', randomArticle.webUrl)
        .single();

      if (!existingArticle) {
        selectedArticle = randomArticle;
      } else {
        attempts++;
      }
    }

    if (!selectedArticle) {
      throw new Error('No unique articles found after multiple attempts');
    }
    
    // Extract content from Guardian API response
    let content = '';
    
    // Try to get body content first (full article text)
    if (selectedArticle.fields?.body) {
      content = selectedArticle.fields.body;
    } 
    // Fallback to trail text (summary)
    else if (selectedArticle.fields?.trailText) {
      content = selectedArticle.fields.trailText;
    }
    // Last resort: use headline
    else if (selectedArticle.fields?.headline) {
      content = selectedArticle.fields.headline;
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

    const articleData = {
      title: selectedArticle.fields?.headline || selectedArticle.webTitle || 'Untitled',
      source: 'The Guardian',
      words: words,
      url: selectedArticle.webUrl,
    };

    // Save the article to the database
    const { data: insertedArticle, error: insertError } = await supabase
      .from('articles')
      .insert([articleData])
      .select()
      .single();

    if (insertError) {
      console.error('Error saving article to database:', insertError);
      // Continue anyway - we still return the article even if saving fails
      return NextResponse.json(articleData);
    }

    return NextResponse.json({
      id: insertedArticle.id,
      title: insertedArticle.title,
      source: insertedArticle.source,
      words: insertedArticle.words,
      url: insertedArticle.url,
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
