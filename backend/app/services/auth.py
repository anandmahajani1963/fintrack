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


# ── Plan / tier helpers ───────────────────────────────────────────────────────

PLAN_FEATURES = {
    "free": {
        "max_accounts":   1,
        "max_months":     12,
        "analytics":      "basic",
        "export":         False,
        "budgets":        False,
        "mfa":            False,
        "live_feeds":     False,
    },
    "household": {
        "max_accounts":   None,   # unlimited
        "max_months":     None,   # unlimited
        "analytics":      "full",
        "export":         True,
        "budgets":        True,
        "mfa":            True,
        "live_feeds":     False,
    },
    "premium": {
        "max_accounts":   None,
        "max_months":     None,
        "analytics":      "full",
        "export":         True,
        "budgets":        True,
        "mfa":            True,
        "live_feeds":     True,
    },
}

def get_plan_features(plan: str) -> dict:
    return PLAN_FEATURES.get(plan, PLAN_FEATURES["free"])

def require_plan(user, required_feature: str, db=None):
    """
    Raise HTTP 403 if user's plan doesn't support the feature.
    Usage: require_plan(current_user, "export")
    """
    from fastapi import HTTPException
    features = get_plan_features(getattr(user, 'plan', 'free'))
    value = features.get(required_feature)
    if value is False:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "plan_required",
                "feature": required_feature,
                "current_plan": getattr(user, 'plan', 'free'),
                "message": f"This feature requires a higher plan. "
                           f"Upgrade from {getattr(user, 'plan', 'free').title()} "
                           f"to access {required_feature}.",
            }
        )
    return value
