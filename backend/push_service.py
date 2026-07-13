"""Web Push (VAPID) helpers for iOS PWA notifications."""
import json
import logging
import os
from typing import Optional

from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)

VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@meditrax.app")


def get_public_key() -> str:
    return VAPID_PUBLIC_KEY


def send_push(subscription: dict, payload: dict) -> dict:
    """Send a single web-push notification. Returns {ok, status, error}."""
    try:
        webpush(
            subscription_info=subscription,
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=600,
        )
        return {"ok": True, "status": 201}
    except WebPushException as e:
        status = getattr(getattr(e, "response", None), "status_code", None)
        logger.warning("WebPush failed (status=%s): %s", status, e)
        return {"ok": False, "status": status, "error": str(e), "expired": status in (404, 410)}
    except Exception as e:  # noqa
        logger.exception("WebPush unexpected error")
        return {"ok": False, "status": None, "error": str(e), "expired": False}
