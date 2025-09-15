# Database Management Guide

This guide shows you how to manage your Supabase database remotely using various methods.

## 🚀 Quick Commands

### NPM Scripts (Recommended)
```bash
# Check database status
npm run db:status

# Clean up expired articles
npm run db:cleanup

# Preload new articles
npm run db:preload

# Reset database (delete all articles)
npm run db:reset
```

### Direct Script Commands
```bash
# Check database status
node scripts/db-manager.js status

# Clean up expired articles
node scripts/db-manager.js cleanup

# Preload new articles
node scripts/db-manager.js preload

# Reset database (delete all articles)
node scripts/db-manager.js reset
```

## 🌐 API Endpoints

### Check Database Status
```bash
curl http://localhost:3001/api/db-status
```

**Response:**
```json
{
  "total_articles": 21,
  "active_articles": 21,
  "expired_articles": 0,
  "articles": [...]
}
```

### Clean Up Expired Articles
```bash
curl -X POST http://localhost:3001/api/db-cleanup
```

### Reset Database
```bash
curl -X POST http://localhost:3001/api/db-reset
```

### Preload Articles
```bash
curl -X POST http://localhost:3001/api/preload-articles
```

## 🖥️ Supabase Dashboard

1. **Go to [supabase.com](https://supabase.com)**
2. **Select your project**
3. **Use these sections:**
   - **Table Editor** - View/edit data
   - **SQL Editor** - Run custom queries
   - **Logs** - Monitor activity
   - **Database** - Health metrics

### Useful SQL Queries

```sql
-- View all articles
SELECT * FROM articles ORDER BY created_at DESC;

-- Count articles by status
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active,
  COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired
FROM articles;

-- Find articles by title
SELECT * FROM articles WHERE title ILIKE '%keyword%';

-- Delete expired articles
DELETE FROM articles WHERE expires_at < NOW();

-- Delete all articles
DELETE FROM articles;
```

## 📊 Database Schema

```sql
CREATE TABLE articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  words TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);
```

## 🔧 Environment Variables

Make sure your `.env.local` file contains:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GUARDIAN_API_KEY=your_guardian_api_key
```

## 🚨 Troubleshooting

### Common Issues

1. **"Invalid supabaseUrl" error**
   - Check your `.env.local` file has correct Supabase credentials
   - Restart your development server

2. **"Database error" messages**
   - Verify your Supabase project is active
   - Check your database permissions

3. **No articles loading**
   - Run `npm run db:preload` to load articles
   - Check if Guardian API key is valid

### Debug Commands

```bash
# Check environment variables
cat .env.local

# Test database connection
npm run db:status

# Check API endpoints
curl http://localhost:3001/api/db-status
```

## 📈 Monitoring

### Real-time Monitoring
- **Supabase Dashboard** - Real-time metrics
- **API Logs** - Check server logs
- **Database Logs** - Query performance

### Automated Cleanup
Set up a cron job to clean expired articles:
```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /path/to/your/app && npm run db:cleanup
```

## 🎯 Best Practices

1. **Regular Cleanup** - Run cleanup weekly
2. **Monitor Usage** - Check database status regularly
3. **Backup Data** - Export important data before major changes
4. **Test Commands** - Always test on development first

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Supabase dashboard for errors
3. Check your environment variables
4. Verify your API keys are valid
