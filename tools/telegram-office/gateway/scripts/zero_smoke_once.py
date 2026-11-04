#!/usr/bin/env python3
"""One-off read-only smoke for the approved 0%-traffic Worker candidate.

Exactly two anonymous version-overridden HTTP requests: health GET, unauthenticated
webhook POST. Never sends a Telegram update, writes Notion/D1, changes a deployment
or reads any secret. Response codes alone cannot prove the target version ran;
use the logged smoke marker and Cloudflare Observability to confirm version ID.
"""
import datetime
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

WORKER = "geoteacher-telegram-gateway"
CANDIDATE = "9d91cea3-c8d3-4322-902c-520fd7d4687b"
ROOT = "https://geoteacher-telegram-gateway.ksoundmin.workers.dev"
MARKER = "geoteacher-zero-smoke-20261104-n74c"
OVERRIDE = WORKER + '="' + CANDIDATE + '"'

def request_one(method, path, expected_status, expected_body):
    endpoint = ROOT + path + "?smoke=" + MARKER
    headers = {
        "Cloudflare-Workers-Version-Overrides": OVERRIDE,
        "User-Agent": "GeoTeacher-zero-percent-readonly-smoke/1",
        "Cache-Control": "no-store",
    }
    request = Request(endpoint, headers=headers, method=method)
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    try:
        with urlopen(request, timeout=15) as response:
            status = response.status
            body = response.read(128).decode("utf-8", errors="replace")
            ray = response.headers.get("CF-Ray")
    except HTTPError as error:
        status = error.code
        body = error.read(128).decode("utf-8", errors="replace")
        ray = error.headers.get("CF-Ray")
    except (URLError, TimeoutError, OSError):
        print(json.dumps({"method": method, "path": path, "time_utc": stamp,
                          "network_error": True, "passed": False}, ensure_ascii=False))
        return False
    passed = status == expected_status and body.strip() == expected_body
    # Never output whole response headers or untrusted body.
    print(json.dumps({"method": method, "path": path, "time_utc": stamp,
                      "http_status": status, "expected_status": expected_status,
                      "body_match": body.strip() == expected_body,
                      "cf_ray": ray if isinstance(ray, str) and len(ray) <= 75 else None,
                      "override_version_requested": CANDIDATE,
                      "executed_version_verified": False,
                      "passed": passed}, ensure_ascii=False))
    return passed

def main():
    # Do not retry to avoid duplicate or ambiguous observations.
    health = request_one("GET", "/health", 200, "ok")
    unauthorized = request_one("POST", "/telegram-webhook", 403, "Forbidden")
    print(json.dumps({
        "request_tests_passed": health and unauthorized,
        "requested_override_version": CANDIDATE,
        "actual_version_id": None,
        "actual_version_id_requires_cloudflare_observability": True,
        "cloudflare_logs_marker": MARKER,
        "telegram_messages_sent": 0, "notion_writes": 0, "d1_writes": 0,
        "deployments_modified": 0, "webhook_settings_changed": False,
    }, ensure_ascii=False))
    return 0 if health and unauthorized else 1

if __name__ == "__main__":
    sys.exit(main())
