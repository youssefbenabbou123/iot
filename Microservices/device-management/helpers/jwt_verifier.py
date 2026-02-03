import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from helpers.config import SIGNING_SERVICE_URL, logger

http_bearer = HTTPBearer()


async def verify_jwt_token(
    token: HTTPAuthorizationCredentials = Security(http_bearer),
) -> dict:
    """
    Verify JWT token by calling the Signing microservice
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SIGNING_SERVICE_URL}/users/verify-token",
                json={"token": token.credentials},
                timeout=5.0,
            )
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Token verified for user: {data.get('payload', {}).get('sub')}")
                return data.get("payload", {})
            else:
                logger.error(f"Token verification failed: {response.status_code}")
                raise HTTPException(status_code=401, detail="Invalid or expired token")
    except httpx.RequestError as e:
        logger.error(f"Error connecting to signing service: {e}")
        raise HTTPException(status_code=503, detail="Signing service unavailable")
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {e}")
        raise HTTPException(status_code=401, detail="Token verification failed")
