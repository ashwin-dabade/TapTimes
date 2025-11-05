from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from typing import List, Optional
from datetime import datetime, timedelta
import httpx
from supabase import create_client, Client
import anthropic
import random
import re
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from middleware.auth import require_auth
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="News Typing API")

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize clients
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
guardian_api_key = os.getenv("GUARDIAN_API_KEY")
claude_api_key = os.getenv("CLAUDE_API_KEY")

if not all([supabase_url, supabase_service_key]):
    raise ValueError("Missing required environment variables")

# Use service role key for backend operations
supabase: Client = create_client(supabase_url, supabase_service_key)
claude_client = anthropic.Anthropic(api_key=claude_api_key) if claude_api_key else None


@app.get("/")
async def root():
    return {"message": "News Typing API", "status": "running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/api/news")
async def get_news(viewed: Optional[str] = Query(None)):
    """Get a random news article for typing practice."""
    try:
        viewed_ids = viewed.split(",") if viewed else []
        
        # Query database for unviewed articles
        query = supabase.table("articles").select("*").gte(
            "expires_at", datetime.now().isoformat()
        ).order("created_at", desc=True)
        
        if viewed_ids:
            query = query.not_.in_("id", viewed_ids)
        
        result = query.execute()
        
        if result.data:
            article = random.choice(result.data)
            return {
                "id": article["id"],
                "title": article["title"],
                "source": article["source"],
                "words": article["words"],
                "url": article["url"],
            }
        
        # Fetch from Guardian API if no articles in DB
        if not guardian_api_key:
            raise HTTPException(status_code=500, detail="Guardian API key not configured")
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://content.guardianapis.com/search",
                params={
                    "api-key": guardian_api_key,
                    "show-fields": "body,headline,trailText",
                    "page-size": 20,
                    "order-by": "newest"
                },
                headers={"User-Agent": "News-Typing-App/1.0"}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Guardian API failed")
            
            data = response.json()
            
            if not data.get("response", {}).get("results"):
                raise HTTPException(status_code=404, detail="No articles found")
            
            for article in data["response"]["results"]:
                content = (
                    article.get("fields", {}).get("body") or
                    article.get("fields", {}).get("trailText") or
                    article.get("fields", {}).get("headline") or ""
                )
                
                clean_content = re.sub(r'<[^>]+>', '', content)
                clean_content = re.sub(r'&[a-zA-Z0-9#]+;', ' ', clean_content)
                clean_content = ' '.join(clean_content.split())
                
                if len(clean_content) < 100:
                    continue
                
                words = clean_content.split()[:200]
                
                return {
                    "id": "temp",
                    "title": article.get("fields", {}).get("headline") or article.get("webTitle"),
                    "source": "The Guardian",
                    "words": words,
                    "url": article.get("webUrl"),
                }
            
            raise HTTPException(status_code=404, detail="No suitable articles found")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching news: {str(e)}")


@app.get("/api/db-status")
async def db_status():
    """Get database statistics"""
    try:
        result = supabase.table("articles").select("*").order("created_at", desc=True).execute()
        
        articles = result.data or []
        
        return {
            "total_articles": len(articles),
            "articles": [
                {
                    "id": a["id"],
                    "title": a["title"],
                    "source": a["source"],
                    "created_at": a["created_at"],
                    "expires_at": a["expires_at"],
                    "word_count": len(a.get("words", [])),
                }
                for a in articles
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/api/db-cleanup")
async def db_cleanup():
    """Delete expired articles"""
    try:
        result = supabase.table("articles").delete().lt(
            "expires_at", datetime.now().isoformat()
        ).execute()
        
        return {
            "message": "Cleanup completed",
            "deleted_count": len(result.data) if result.data else 0,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")


@app.post("/api/db-reset")
async def db_reset():
    """Delete ALL articles"""
    try:
        result = supabase.table("articles").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        
        return {
            "message": "Database reset completed",
            "deleted_count": len(result.data) if result.data else 0,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")


@app.post("/api/preload-articles")
async def preload_articles():
    """Fetch and summarize articles using Claude"""
    if not claude_client:
        raise HTTPException(status_code=500, detail="Claude API key not configured")
    
    if not guardian_api_key:
        raise HTTPException(status_code=500, detail="Guardian API key not configured")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://content.guardianapis.com/search",
                params={
                    "api-key": guardian_api_key,
                    "show-fields": "body,headline,trailText",
                    "page-size": 10,
                    "order-by": "newest"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Guardian API failed")
            
            data = response.json()
            articles_data = data.get("response", {}).get("results", [])
        
        inserted_count = 0
        
        for article in articles_data:
            content = (
                article.get("fields", {}).get("body") or
                article.get("fields", {}).get("trailText") or
                article.get("fields", {}).get("headline") or ""
            )
            
            clean_content = re.sub(r'<[^>]+>', '', content)
            clean_content = re.sub(r'&[a-zA-Z0-9#]+;', ' ', clean_content)
            clean_content = ' '.join(clean_content.split())[:4000]
            
            if len(clean_content) < 100:
                continue
            
            try:
                message = claude_client.messages.create(
                    model="claude-3-5-sonnet-20241022",
                    max_tokens=500,
                    messages=[{
                        "role": "user",
                        "content": f"Summarize this news article in 100-150 words:\n\n{clean_content}"
                    }]
                )
                summary = message.content[0].text
            except Exception as e:
                print(f"Summarization failed: {e}")
                continue
            
            article_data = {
                "title": article.get("fields", {}).get("headline") or article.get("webTitle") or "Untitled",
                "source": "The Guardian",
                "summary": summary,
                "url": article.get("webUrl"),
                "words": summary.split(),
            }
            
            try:
                supabase.table("articles").insert(article_data).execute()
                inserted_count += 1
                print(f"✅ Inserted: {article_data['title']}")
            except Exception as e:
                print(f"Error inserting article: {e}")
                continue
        
        return {
            "message": f"Preloaded {inserted_count} articles",
            "inserted_count": inserted_count,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preload failed: {str(e)}")


# Models
class TestResult(BaseModel):
    topic: str
    article_title: str
    wpm: int
    accuracy: int
    time: int


# Auth-protected endpoints
@app.get("/api/tests/history")
async def get_test_history(user=Depends(require_auth)):
    """Get authenticated user's test history"""
    user_id = user.get("id")

    result = supabase.table('typing_tests') \
        .select('*') \
        .eq('user_id', user_id) \
        .order('completed_at', desc=True) \
        .execute()

    return {"tests": result.data}


@app.get("/api/tests/stats")
async def get_test_stats(user=Depends(require_auth)):
    """Get authenticated user's statistics"""
    user_id = user.get("id")

    result = supabase.table('typing_tests') \
        .select('wpm, accuracy, time') \
        .eq('user_id', user_id) \
        .execute()

    tests = result.data

    if not tests:
        return {
            "total_tests": 0,
            "average_wpm": 0,
            "average_accuracy": 0,
            "total_time": 0
        }

    total_tests = len(tests)
    total_wpm = sum(t['wpm'] for t in tests)
    total_accuracy = sum(t['accuracy'] for t in tests)
    total_time = sum(t['time'] for t in tests)

    return {
        "total_tests": total_tests,
        "average_wpm": round(total_wpm / total_tests),
        "average_accuracy": round(total_accuracy / total_tests),
        "total_time": total_time
    }


@app.post("/api/tests")
@limiter.limit("10/minute")  # Rate limit: 10 tests per minute
async def save_test(
    request: Request,
    test_data: TestResult,
    user=Depends(require_auth)
):
    """Save test result for authenticated user"""
    user_id = user.get("id")

    # Insert test with verified user_id from token
    result = supabase.table('typing_tests').insert({
        "user_id": user_id,
        "topic": test_data.topic,
        "article_title": test_data.article_title,
        "wpm": test_data.wpm,
        "accuracy": test_data.accuracy,
        "time": test_data.time
    }).execute()

    return {"success": True, "test": result.data}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)