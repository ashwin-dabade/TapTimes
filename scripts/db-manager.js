// Database management script for News Typing App
// Provides CLI commands to check status, clean up, reset, and preload/summarize news articles from The Guardian using Claude AI.

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
// Uses Node.js built-in fetch (Node 18+) or node-fetch if needed

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Checks the current status of the articles database.
 * Prints statistics and recent articles to the console.
 */
async function checkDatabaseStatus() {
  console.log('🔍 Checking database status...\n');
  try {
    // Fetch all articles, newest first
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const now = new Date();
    // Separate active and expired articles
    const activeArticles = articles?.filter(article => new Date(article.expires_at) > now) || [];
    const expiredArticles = articles?.filter(article => new Date(article.expires_at) <= now) || [];
    console.log('📊 Database Statistics:');
    console.log(`   Total articles: ${articles?.length || 0}`);
    console.log(`   Active articles: ${activeArticles.length}`);
    console.log(`   Expired articles: ${expiredArticles.length}`);
    console.log('');
    // Print details of the 5 most recent articles
    if (articles && articles.length > 0) {
      console.log('📰 Recent Articles:');
      articles.slice(0, 5).forEach((article, index) => {
        const isExpired = new Date(article.expires_at) <= now;
        const status = isExpired ? '❌ EXPIRED' : '✅ ACTIVE';
        console.log(`   ${index + 1}. ${article.title} (${status})`);
        console.log(`      ID: ${article.id}`);
        console.log(`      Created: ${new Date(article.created_at).toLocaleString()}`);
        console.log(`      Expires: ${new Date(article.expires_at).toLocaleString()}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  }
}

/**
 * Deletes all expired articles from the database.
 * Expired = expires_at is in the past.
 */
async function cleanupExpiredArticles() {
  console.log('🧹 Cleaning up expired articles...\n');
  try {
    const { data: deletedArticles, error } = await supabase
      .from('articles')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select();
    if (error) throw error;
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

/**
 * Deletes ALL articles from the database (except a reserved ID).
 * WARNING: This is destructive and should be used with caution.
 */
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
    if (error) throw error;
    console.log(`✅ Successfully reset database - deleted ${deletedArticles?.length || 0} articles`);
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
  }
}

/**
 * Summarizes a given text using Claude's API (Haiku model, cheapest tier).
 * Returns a 100-word summary as a string.
 * Throws if the API key is missing or the API call fails.
 */
async function summarizeWithClaude(text) {
  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) throw new Error('Claude API key not set');
  // Call Anthropic Claude API for summarization
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307', // Cheapest Claude 3 model
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Summarize the following article in 100 words:\n\n${text}`
        }
      ]
    })
  });
  const data = await response.json();
  // Claude returns an array of content blocks
  if (data.content && Array.isArray(data.content) && data.content.length > 0) {
    return data.content[0].text.trim();
  }
  throw new Error('Claude API did not return a summary');
}

/**
 * Fetches up to 5 new articles from The Guardian, summarizes each with Claude,
 * and inserts the summary into the database. Skips duplicates and short articles.
 */
async function addNewArticles() {
  const API_KEY = process.env.GUARDIAN_API_KEY;
  if (!API_KEY) {
    console.error('❌ Guardian API key not configured. Please add GUARDIAN_API_KEY to your .env.local file.');
    process.exit(1);
  }
  if (!process.env.CLAUDE_API_KEY) {
    console.error('❌ Claude API key not configured. Please add CLAUDE_API_KEY to your .env.local file.');
    process.exit(1);
  }
  console.log('⬇️  Preloading articles from The Guardian and summarizing with Claude...');
  try {
    // Fetch 5 recent articles from The Guardian API
    const response = await fetch(
      `https://content.guardianapis.com/search?api-key=${API_KEY}&show-fields=body,headline,trailText&page-size=5&order-by=newest`,
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
      if (insertedCount >= 5) break; // Limit to 5 per run
      // Check for duplicates by URL
      const { data: existingArticle } = await supabase
        .from('articles')
        .select('id')
        .eq('url', article.webUrl)
        .single();
      if (existingArticle) continue;
      // Extract and clean article content
      let content = '';
      if (article.fields?.body) content = article.fields.body;
      else if (article.fields?.trailText) content = article.fields.trailText;
      else if (article.fields?.headline) content = article.fields.headline;
      const cleanContent = content
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
        .replace(/\s+/g, ' ') // Collapse whitespace
        .trim()
        .substring(0, 4000); // Limit to 4000 chars for Claude
      if (cleanContent.length < 100) continue; // Skip very short articles
      let summary;
      try {
        summary = await summarizeWithClaude(cleanContent);
      } catch (e) {
        console.error('Summarization failed:', e.message);
        continue;
      }
      // Prepare article data for insertion
      const articleData = {
        title: article.fields?.headline || article.webTitle || 'Untitled',
        source: 'The Guardian',
        summary, // Store the summary text
        url: article.webUrl,
        words: summary.split(' '), // For legacy compatibility (can be removed if schema allows)
      };
      // Insert into Supabase
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
    console.log(`\n🎉 Preloaded ${insertedCount} new summarized articles.`);
  } catch (error) {
    console.error('❌ Error preloading articles:', error.message);
  }
}

// --- Command line interface ---
// Usage: node scripts/db-manager.js <command>
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
    console.log('  load      - Preload and summarize 5 articles from The Guardian API');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/db-manager.js status');
    console.log('  node scripts/db-manager.js cleanup');
    break;
}
