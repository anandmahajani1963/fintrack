# ============================================================
# fintrack — Stripe billing router
# File: backend/app/routers/stripe_billing.py
# Version: 1.0 — 2026-07-14
# ============================================================

import os
import json
import logging
import stripe
from app.services.secrets import get_secret
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.services.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Stripe configuration ────────────────────────────────────
stripe.api_key = get_secret("fintrack/stripe-secret-key", "STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = get_secret("fintrack/stripe-webhook-secret", "STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://fintrack.nudgelabs.app")

# ── Price ID mapping ────────────────────────────────────────
PRICE_IDS = {
    "household_monthly": "price_1TuG1J70wWEY3XB2YEmdnPFi",
    "household_annual":  "price_1TuG1J70wWEY3XB2b11Vo4Iz",
    "premium_monthly":   "price_1TuG1H70wWEY3XB2hZeOp2SN",
    "premium_annual":    "price_1TuG1G70wWEY3XB2zTDFEx7Z",
}

# Reverse lookup: price_id -> plan name
PRICE_TO_PLAN = {v: k.split("_")[0] for k, v in PRICE_IDS.items()}


# ── Request models ──────────────────────────────────────────
class CheckoutRequest(BaseModel):
    price_key: str  # e.g. "household_monthly", "household_annual"


# ── Create Checkout Session ─────────────────────────────────
@router.post("/create-checkout-session")
def create_checkout_session(
    req: CheckoutRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Checkout Session for upgrading the user's plan.
    Returns the checkout URL for the frontend to redirect to.
    """
    if req.price_key not in PRICE_IDS:
        raise HTTPException(status_code=400, detail="Invalid price selection")

    price_id = PRICE_IDS[req.price_key]
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        # Check if user already has a Stripe customer ID
        is_returning = bool(getattr(user, 'stripe_customer_id', None))
        customer_id = getattr(user, 'stripe_customer_id', None)

        if not customer_id:
            # Create a new Stripe customer
            customer = stripe.Customer.create(
                email=user.email,
                metadata={"fintrack_user_id": str(user.id)},
            )
            customer_id = customer.id
            user.stripe_customer_id = customer_id
            db.commit()

        # Create Checkout Session with 14-day free trial
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            subscription_data={
                **({"trial_period_days": 14} if not is_returning else {}),
                "metadata": {
                    "fintrack_user_id": str(user.id),
                    "plan": PRICE_TO_PLAN.get(price_id, "household"),
                },
            },
            success_url=f"{FRONTEND_URL}?upgrade=success",
            cancel_url=f"{FRONTEND_URL}?upgrade=cancelled",
            metadata={"fintrack_user_id": str(user.id)},
        )

        return {"checkout_url": session.url}

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ── Stripe Webhook ──────────────────────────────────────────
@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Handle Stripe webhook events.
    Updates user plan on successful subscription creation/update/cancellation.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        else:
            # Sandbox without webhook secret configured
            event = stripe.Event.construct_from(
                json.loads(payload), stripe.api_key
            )
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.error(f"Webhook signature error: {e}")
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    event_type = event["type"]
    logger.info(f"Stripe webhook: {event_type}")

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(event["data"]["object"], db)
    elif event_type == "customer.subscription.updated":
        _handle_subscription_updated(event["data"]["object"], db)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_cancelled(event["data"]["object"], db)
    elif event_type == "invoice.payment_failed":
        logger.warning(f"Payment failed for customer: {event['data']['object'].get('customer')}")

    return {"status": "ok"}


# ── Webhook handlers ────────────────────────────────────────
def _handle_checkout_completed(session, db):
    """User completed checkout — activate their plan."""
    user_id = session.get("metadata", {}).get("fintrack_user_id")
    if not user_id:
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return

    subscription_id = session.get("subscription")
    if subscription_id:
        subscription = stripe.Subscription.retrieve(subscription_id)
        price_id = subscription["items"]["data"][0]["price"]["id"]
        plan = PRICE_TO_PLAN.get(price_id, "household")
        user.plan = plan
        user.stripe_customer_id = session.get("customer")
        db.commit()
        logger.info(f"User {user.email} upgraded to {plan}")


def _handle_subscription_updated(subscription, db):
    """Subscription changed — update plan level."""
    customer_id = subscription.get("customer")
    if not customer_id:
        return

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user:
        return

    status = subscription.get("status")
    if status in ("active", "trialing"):
        price_id = subscription["items"]["data"][0]["price"]["id"]
        user.plan = PRICE_TO_PLAN.get(price_id, user.plan)
    elif status in ("canceled", "incomplete_expired"):
        user.plan = "free"

    db.commit()
    logger.info(f"Subscription updated for {user.email}: status={status}, plan={user.plan}")


def _handle_subscription_cancelled(subscription, db):
    """Subscription cancelled — downgrade to free."""
    customer_id = subscription.get("customer")
    if not customer_id:
        return

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user:
        return

    user.plan = "free"
    db.commit()
    logger.info(f"Subscription cancelled for {user.email}, downgraded to free")


# ── Customer Portal ─────────────────────────────────────────
@router.post("/customer-portal")
def create_portal_session(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a Stripe Customer Portal session.
    Allows users to manage subscription, update payment, or cancel.
    """
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user or not getattr(user, 'stripe_customer_id', None):
        raise HTTPException(status_code=400, detail="No active subscription found")

    try:
        session = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=FRONTEND_URL,
        )
        return {"portal_url": session.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
