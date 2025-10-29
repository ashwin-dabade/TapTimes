// frontend/src/lib/api.ts
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function fetchNews(viewedIds: string[] = []) {
  const queryParams = viewedIds.length > 0 
    ? `?viewed=${viewedIds.join(',')}` 
    : '';
    
  const response = await fetch(`${BACKEND_URL}/api/news${queryParams}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch news: ${response.status}`);
  }
  
  return response.json();
}

export async function getDbStatus() {
  const response = await fetch(`${BACKEND_URL}/api/db-status`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch DB status: ${response.status}`);
  }
  
  return response.json();
}

export async function cleanupDb() {
  const response = await fetch(`${BACKEND_URL}/api/db-cleanup`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to cleanup DB: ${response.status}`);
  }
  
  return response.json();
}

export async function resetDb() {
  const response = await fetch(`${BACKEND_URL}/api/db-reset`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to reset DB: ${response.status}`);
  }
  
  return response.json();
}

export async function preloadArticles() {
  const response = await fetch(`${BACKEND_URL}/api/preload-articles`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to preload articles: ${response.status}`);
  }
  
  return response.json();
}