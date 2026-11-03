#!/usr/bin/env python3
"""Securely register/inspect/remove Telegram webhook (no tokens in URLs or logs)."""
import json
import os
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def request(method, payload=None):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Missing TELEGRAM_BOT_TOKEN GitHub secret")
    url = f"https://api.telegram.org/bot{token}/{method}"
    content = json.dumps(payload).encode() if payload is not None else None
    req = Request(url, data=content, headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=15) as response:
            data = json.load(response)
    except HTTPError as error:
        # Only fixed diagnostic labels are logged; never the remote body or secrets.
        category = "unclassified"
        try:
            detail = json.loads(error.read(8192)).get("description", "").lower()
            categories = (
                ("resolve host", "worker_dns_resolution"),
                ("ssl", "worker_tls_certificate"),
                ("certificate", "worker_tls_certificate"),
                ("secret", "webhook_secret_rejected"),
                ("https", "webhook_https_required"),
                ("url", "webhook_url_rejected"),
                ("ip address", "webhook_ip_rejected"),
                ("webhook", "webhook_rejected"),
            )
            category = next((label for needle, label in categories if needle in detail), category)
        except (ValueError, AttributeError, TypeError):
            pass
        raise RuntimeError(f"Telegram {method} returned HTTP {error.code}; category={category}") from None
    if not data.get("ok"):
        raise RuntimeError(f"Telegram method {method} failed")
    return data["result"]


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "status"
    if action == "install":
        base = os.environ.get("TELEGRAM_WORKER_URL", "").strip().rstrip("/")
        secret = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "").strip()
        if not base.startswith("https://") or not secret:
            raise RuntimeError("Set TELEGRAM_WORKER_URL variable and TELEGRAM_WEBHOOK_SECRET secret")
        if any(c not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-" for c in secret):
            raise RuntimeError("Webhook secret supports only A-Z, a-z, 0-9, _ and -")
        if len(secret) < 16 or len(secret) > 256:
            raise RuntimeError("Webhook secret must have between 16 and 256 characters")
        request("setWebhook", {
            "url": base + "/telegram-webhook",
            "secret_token": secret,
            "max_connections": 1,
            "allowed_updates": ["message"],
            "drop_pending_updates": True,
        })
        print("Webhook registered. Old pending messages were intentionally discarded.")
    elif action == "remove":
        request("deleteWebhook", {"drop_pending_updates": False})
        print("Webhook removed. Cloud command reception is now disabled.")
    elif action != "status":
        raise RuntimeError("Allowed modes: install, status, remove")
    info = request("getWebhookInfo")
    # URL is public but may reveal account subdomain, not bot secrets.
    print("Webhook URL:", info.get("url") or "(none)")
    print("Queued updates:", info.get("pending_update_count", 0))
    print("Last webhook error timestamp:", info.get("last_error_date", "(none)"))
    print("Webhook configured:", bool(info.get("url")))


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        sys.exit(1)
