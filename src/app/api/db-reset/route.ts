import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST() {
  try {
    // Delete all articles (use with caution!)
    const { data: deletedArticles, error: deleteError } = await supabase
      .from('articles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all articles
      .select();

    if (deleteError) {
      throw new Error(`Database error: ${deleteError.message}`);
    }

    return NextResponse.json({
      message: `Successfully reset database - deleted ${deletedArticles?.length || 0} articles`,
      deleted_articles: deletedArticles?.length || 0
    });

  } catch (error) {
    console.error('Error resetting database:', error);
    return NextResponse.json(
      { 
        error: 'Failed to reset database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
