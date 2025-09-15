import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // Delete expired articles
    const { data: deletedArticles, error: deleteError } = await supabase
      .from('articles')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (deleteError) {
      throw new Error(`Database error: ${deleteError.message}`);
    }

    return NextResponse.json({
      message: `Successfully cleaned up ${deletedArticles?.length || 0} expired articles`,
      deleted_articles: deletedArticles?.map(article => ({
        id: article.id,
        title: article.title,
        expired_at: article.expires_at
      })) || []
    });

  } catch (error) {
    console.error('Error cleaning up database:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clean up database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
