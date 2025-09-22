#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseStatus() {
  console.log('🔍 Checking database status...\n');
  
  try {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const now = new Date();
    const activeArticles = articles?.filter(article => 
      new Date(article.expires_at) > now
    ) || [];
    
    const expiredArticles = articles?.filter(article => 
      new Date(article.expires_at) <= now
    ) || [];

    console.log('📊 Database Statistics:');
    console.log(`   Total articles: ${articles?.length || 0}`);
    console.log(`   Active articles: ${activeArticles.length}`);
    console.log(`   Expired articles: ${expiredArticles.length}`);
    console.log('');

    if (articles && articles.length > 0) {
      console.log('📰 Recent Articles:');
      articles.slice(0, 5).forEach((article, index) => {
        const isExpired = new Date(article.expires_at) <= now;
        const status = isExpired ? '❌ EXPIRED' : '✅ ACTIVE';
        console.log(`   ${index + 1}. ${article.title} (${status})`);
        console.log(`      ID: ${article.id}`);
        console.log(`      Words: ${article.words?.length || 0}`);
        console.log(`      Created: ${new Date(article.created_at).toLocaleString()}`);
        console.log(`      Expires: ${new Date(article.expires_at).toLocaleString()}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  }
}

async function cleanupExpiredArticles() {
  console.log('🧹 Cleaning up expired articles...\n');
  
  try {
    const { data: deletedArticles, error } = await supabase
      .from('articles')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      throw error;
    }

    console.log(`✅ Successfully deleted ${deletedArticles?.length || 0} expired articles`);
    
    if (deletedArticles && deletedArticles.length > 0) {
      console.log('\n🗑️ Deleted articles:');
      deletedArticles.forEach((article, index) => {
        console.log(`   ${index + 1}. ${article.title}`);
      });
    }

  } catch (error) {
    console.error('❌ Error cleaning up articles:', error.message);
  }
}

async function resetDatabase() {
  console.log('⚠️  WARNING: This will delete ALL articles!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    const { data: deletedArticles, error } = await supabase
      .from('articles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select();

    if (error) {
      throw error;
    }

    console.log(`✅ Successfully reset database - deleted ${deletedArticles?.length || 0} articles`);

  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
  }
}

async function addNewArticles() {
  const API_KEY = process.env.GUARDIAN_API_KEY;
  if (!API_KEY) {
    console.error('❌ Guardian API key not configured. Please add GUARDIAN_API_KEY to your .env.local file.');
    process.exit(1);
  }
  console.log('⬇️  Preloading articles from The Guardian...');
  try {
    const response = await fetch(
      `https://content.guardianapis.com/search?api-key=${API_KEY}&show-fields=body,headline,trailText&page-size=20&order-by=newest`,
      {
        headers: { 'User-Agent': 'News-Typing-App/1.0' },
      }
    );
    if (!response.ok) {
      throw new Error(`Guardian API request failed: ${response.status}`);
    }
    const data = await response.json();
    if (data.response?.status !== 'ok' || !data.response?.results || data.response.results.length === 0) {
      throw new Error('No articles found');
    }
    let insertedCount = 0;
    for (const article of data.response.results) {
      if (insertedCount >= 10) break;
      // Check if this article URL already exists in database
      const { data: existingArticle } = await supabase
        .from('articles')
        .select('id')
        .eq('url', article.webUrl)
        .single();
      if (existingArticle) continue;
      // Extract content
      let content = '';
      if (article.fields?.body) content = article.fields.body;
      else if (article.fields?.trailText) content = article.fields.trailText;
      else if (article.fields?.headline) content = article.fields.headline;
      const cleanContent = content
        .replace(/<[^>]*>/g, '')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 1000);
      const words = cleanContent.split(' ').filter(word => word.length > 0).slice(0, 80);
      if (words.length === 0) continue;
      const articleData = {
        title: article.fields?.headline || article.webTitle || 'Untitled',
        source: 'The Guardian',
        words: words,
        url: article.webUrl,
      };
      const { error: insertError } = await supabase
        .from('articles')
        .insert([articleData]);
      if (insertError) {
        console.error('Error saving article to database:', insertError);
        continue;
      }
      insertedCount++;
      console.log(`✅ Inserted: ${articleData.title}`);
    }
    console.log(`\n🎉 Preloaded ${insertedCount} new articles.`);
  } catch (error) {
    console.error('❌ Error preloading articles:', error.message);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'status':
    checkDatabaseStatus();
    break;
  case 'cleanup':
    cleanupExpiredArticles();
    break;
  case 'reset':
    resetDatabase();
    break;
  case 'load':
    addNewArticles();
    break;
  default:
    console.log('🗄️  Database Manager');
    console.log('');
    console.log('Usage: node scripts/db-manager.js <command>');
    console.log('');
    console.log('Commands:');
    console.log('  status    - Check database status and statistics');
    console.log('  cleanup   - Delete expired articles');
    console.log('  reset     - Delete ALL articles (use with caution!)');
    console.log('  preload   - Preload 10 articles from The Guardian API');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/db-manager.js status');
    console.log('  node scripts/db-manager.js cleanup');
    break;
}
