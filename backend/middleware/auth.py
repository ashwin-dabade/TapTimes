from fastapi import HTTPException, Header
from jose import jwt
import os
import httpx


async def require_auth(authorization: str = Header(None)):
    """Verify Supabase JWT token and return user info"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    token = authorization.split('Bearer ')[1]

    try:
        # Get Supabase JWT secret from environment
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        # Verify token by calling Supabase
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": supabase_key
                }
            )

            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid token")

            user = response.json()
            return user

    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
