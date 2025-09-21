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
  default:
    console.log('🗄️  Database Manager');
    console.log('');
    console.log('Usage: node scripts/db-manager.js <command>');
    console.log('');
    console.log('Commands:');
    console.log('  status    - Check database status and statistics');
    console.log('  cleanup   - Delete expired articles');
    console.log('  reset     - Delete ALL articles (use with caution!)');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/db-manager.js status');
    console.log('  node scripts/db-manager.js cleanup');
    break;
}
