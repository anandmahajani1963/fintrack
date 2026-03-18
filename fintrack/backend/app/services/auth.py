# ============================================================
# fintrack — Auth dependency (FastAPI)
# File: backend/app/services/auth.py
#
# Usage in any router:
#   from app.services.auth import get_current_user, CurrentUser
#
#   @router.get("/me")
#   def get_me(user: CurrentUser):
#       return {"id": str(user.id), "email": user.email}
# ============================================================

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Annotated

from app.database import get_db
from app.models.user import User
from app.services.token import get_user_id_from_token

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency — extracts and validates Bearer token,
    returns the authenticated User ORM object.
    Raises 401 if token is missing, invalid, or expired.
    """
    token = credentials.credentials
    user_id = get_user_id_from_token(token)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True,
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# Convenient type alias for router function signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
