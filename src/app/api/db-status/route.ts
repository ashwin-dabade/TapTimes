import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Get all articles
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Database error', details: error.message },
        { status: 500 }
      );
    }

    // Calculate statistics
    const now = new Date();
    const activeArticles = articles?.filter(article => 
      new Date(article.expires_at) > now
    ) || [];
    
    const expiredArticles = articles?.filter(article => 
      new Date(article.expires_at) <= now
    ) || [];

    return NextResponse.json({
      total_articles: articles?.length || 0,
      active_articles: activeArticles.length,
      expired_articles: expiredArticles.length,
      articles: articles?.map(article => ({
        id: article.id,
        title: article.title,
        source: article.source,
        created_at: article.created_at,
        expires_at: article.expires_at,
        word_count: article.words?.length || 0
      })) || []
    });

  } catch (error) {
    console.error('Error checking database:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
