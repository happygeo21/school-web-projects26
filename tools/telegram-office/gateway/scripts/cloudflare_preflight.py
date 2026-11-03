#!/usr/bin/env python3
"""Cloudflare read-only diagnostic for GeoTeacher.

Intentionally no POST/PATCH/PUT/DELETE requests or logging of secrets/code.
Run only from GitHub Actions workflow_dispatch using scoped account token.
"""
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

API_ROOT = "https://api.cloudflare.com/client/v4"
WORKER = "geoteacher-telegram-gateway"
D1_NAME = "geoteacher-task-approvals"


def get_json(endpoint, token):
    req = Request(API_ROOT + endpoint, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "GeoTeacher-Cloudflare-Preflight/1.0",
    }, method="GET")
    try:
        with urlopen(req, timeout=20) as handle:
            doc = json.load(handle)
    except HTTPError as exc:
        # Do not print response bodies or request headers (could include private data).
        raise RuntimeError(f"Cloudflare API returned HTTP {exc.code} for read-only check") from exc
    except URLError as exc:
        raise RuntimeError("Cloudflare API could not be reached from GitHub runner") from exc
    if not isinstance(doc, dict) or not doc.get("success"):
        raise RuntimeError("Cloudflare API returned a non-success result")
    return doc.get("result")


def main():
    token = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()
    account = os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip()
    if not token or not account:
        raise RuntimeError("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID as GitHub Secrets")
    if len(account) != 32 or any(c not in "0123456789abcdefABCDEF" for c in account):
        raise RuntimeError("Cloudflare account ID must be a 32-digit hexadecimal ID")

    base = "/accounts/" + account
    slug = quote(WORKER, safe="")
    print("Mode: READ ONLY | Worker:", WORKER)
    deployments_data = get_json(f"{base}/workers/scripts/{slug}/deployments?per_page=5", token)
    items = deployments_data.get("deployments", []) if isinstance(deployments_data, dict) else []
    if not items:
        raise RuntimeError("No Worker deployment records found")
    current = items[0]
    print("Most recent active deployment ID:", current.get("id", "unknown"))
    print("Deployment time UTC:", current.get("created_on", "unknown"))
    print("Serving versions:")
    for version in current.get("versions", []):
        print("  version:", version.get("version_id", "unknown"), "traffic %:", version.get("percentage", "unknown"))
    print("Note: deployment IDs and version IDs are metadata, not source comparisons.")

    info = get_json(f"{base}/workers/scripts/{slug}/script-settings", token)
    print("Worker settings readable:", isinstance(info, dict))
    # Observability status only; do not output bindings, script source, user data, or secrets.
    if isinstance(info, dict):
        print("Observability enabled:", (info.get("observability") or {}).get("enabled", "unknown"))

    databases = get_json(f"{base}/d1/database?{urlencode({'name': D1_NAME, 'per_page': '20'})}", token)
    db_items = databases if isinstance(databases, list) else (
        databases.get("results", []) if isinstance(databases, dict) else []
    )
    matches = [d for d in db_items if d.get("name") == D1_NAME]
    print("D1 database with expected name found:", bool(matches))
    for db in matches:
        print("  D1 database ID:", db.get("uuid") or db.get("id") or "unknown")
    if not matches:
        raise RuntimeError("Expected D1 database not listed. Verify account selection.")
    print("Preflight complete: READ ONLY. Nothing was deployed or modified.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as exc:
        print(f"READ-ONLY CHECK FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
