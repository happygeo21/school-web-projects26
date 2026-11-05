#!/usr/bin/env python3
"""One-shot protected, read-only proof of the 0% GeoTeacher Worker candidate.

A temporary Wrangler live-tail session is filtered to one fixed Worker version.
Only two anonymous HTTP probes are sent. The Tail connection does not upload,
deploy, modify the webhook, access D1 rows, or read/write Notion. Never print
untrusted event logs, request headers or any credentials.
"""
import json
import os
from pathlib import Path
import queue
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from cloudflare_preflight import WORKER, get_json
from worker_candidate import Stop, child_environment, context, candidate_bindings, require
from worker_zero_deploy import (
    BASE_VERSION, CANDIDATE_VERSION, exact_split, main_sha, protected_environment,
)

DEPLOYMENT_ID = "99157fb4-d5bd-4d3d-b2f7-e01171158ff7"
CONFIRMATION = "VERIFY TAIL ONLY geoteacher-telegram-gateway"
HOST = "geoteacher-telegram-gateway.ksoundmin.workers.dev"
ROOT = "https://" + HOST
EXPECTED = {("GET", "/health"): (200, "ok"),
            ("POST", "/telegram-webhook"): (403, "Forbidden")}


def safe_marker():
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    require(bool(re.fullmatch(r"[0-9]{4,18}", run_id)), "Missing numeric GitHub run ID.")
    return "geoteacher-tail-verify-" + run_id


def inspect_current():
    """Check exact deployment and disabled candidate via the existing read token."""
    sha = main_sha()
    base, token = context()
    worker = base + "/workers/scripts/" + WORKER
    deployments = get_json(worker + "/deployments?per_page=5", token)
    entries = deployments.get("deployments", [])
    require(bool(entries), "Worker deployments were not returned.")
    current = exact_split(entries[0])
    require(current == DEPLOYMENT_ID, "Current deployment changed; stop before probes.")
    version = get_json(worker + "/versions/" + CANDIDATE_VERSION, token)
    require(version.get("id") == CANDIDATE_VERSION, "Candidate version not found.")
    bindings = candidate_bindings(version)
    require(bindings["add_enabled"] is False, "Candidate must remain disabled.")
    return {"github_main_checked": sha,
            "deployment_id": current,
            "existing_version": BASE_VERSION,
            "existing_traffic_percent": 100,
            "candidate_version": CANDIDATE_VERSION,
            "candidate_traffic_percent": 0,
            "add_enabled": False}


def tail_command():
    """Only ephemeral, version-filtered logs; absolutely no deploy/write commands."""
    return ["npx", "--yes", "wrangler@4.157.0", "tail", WORKER,
            "--format", "json", "--version-id", CANDIDATE_VERSION]


def parse_tail_match(raw_line, marker):
    """Process in memory; return allowlisted metadata for the two owned probes."""
    try:
        event = json.loads(raw_line)
    except (ValueError, TypeError):
        return None
    if not isinstance(event, dict):
        return None
    request = (event.get("event") or {}).get("request") or {}
    if not isinstance(request, dict):
        return None
    url = request.get("url", "")
    if not isinstance(url, str) or marker not in url:
        return None
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname != HOST or ("smoke=" + marker) not in parts.query:
        return None
    method = request.get("method")
    pair = (method, parts.path)
    if pair not in EXPECTED:
        return None
    metadata = event.get("scriptVersion") or event.get("$workers", {}).get("scriptVersion") or {}
    if not isinstance(metadata, dict):
        metadata = {}
    explicit = metadata.get("id")
    if explicit is not None and explicit != CANDIDATE_VERSION:
        raise Stop("Tail event version conflicts with the requested candidate.")
    return {"method": method, "path": parts.path,
            "explicit_version_id": explicit if explicit == CANDIDATE_VERSION else None}


def one_probe(method, path, marker):
    status_expected, body_expected = EXPECTED[(method, path)]
    request = Request(ROOT + path + "?smoke=" + marker,
                      method=method,
                      headers={
                          "Cloudflare-Workers-Version-Overrides":
                              WORKER + '="' + CANDIDATE_VERSION + '"',
                          "User-Agent": "GeoTeacher-ReadOnly-Tail-Verify",
                          "Cache-Control": "no-store",
                      })
    try:
        with urlopen(request, timeout=12) as response:
            status, body = response.status, response.read(100)
    except HTTPError as error:
        status, body = error.code, error.read(100)
    except (URLError, TimeoutError, OSError):
        return False
    return status == status_expected and body.decode("utf-8", errors="replace").strip() == body_expected


def stream_pipe(pipe, channel, messages):
    try:
        for line in pipe:
            # No stdout/stderr raw text is printed or persisted.
            messages.put((channel, line))
    finally:
        pipe.close()


def stop_tail(process):
    if process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=4)
        except (ProcessLookupError, subprocess.TimeoutExpired):
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait(timeout=3)
    else:
        process.wait(timeout=2)


def run_tail_probe(marker, root):
    """Subscribe first, send two probes exactly once, collect only matching events."""
    require(Path("/dev/shm").is_dir(), "Memory-backed temporary logs unavailable.")
    worker_token = os.environ.get("CLOUDFLARE_WORKER_STAGING_TOKEN", "").strip()
    require(bool(worker_token), "Protected Worker tail credential unavailable.")
    with tempfile.TemporaryDirectory(prefix="geoteacher-tail-", dir="/dev/shm") as private:
        env = child_environment()
        env.update({"CLOUDFLARE_API_TOKEN": worker_token,
                    "CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV": "false",
                    "WRANGLER_SEND_METRICS": "false",
                    "WRANGLER_LOG_PATH": private + "/wrangler.log",
                    "npm_config_logs_dir": private + "/npm",
                    "CI": "true",
                    "NO_COLOR": "1"})
        process = subprocess.Popen(tail_command(), cwd=root, env=env,
                                   start_new_session=True, text=True, bufsize=1,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        messages = queue.Queue()
        for channel, pipe in [("out", process.stdout), ("err", process.stderr)]:
            threading.Thread(target=stream_pipe, args=(pipe, channel, messages), daemon=True).start()
        try:
            ready = False
            deadline = time.monotonic() + 35
            while time.monotonic() < deadline and not ready:
                if process.poll() is not None:
                    raise Stop("Cloudflare tail session stopped before the smoke requests.")
                try:
                    channel, line = messages.get(timeout=0.5)
                except queue.Empty:
                    continue
                # This is a Wrangler progress indication only, never request data.
                low = line.lower()
                ready = ("successfully created tail" in low
                         or "connected to" in low
                         or "tail session started" in low
                         or "listening for logs" in low)
            require(ready, "Could not confirm tail connection; no HTTP probes sent.")
            results = {pair: one_probe(*pair, marker) for pair in EXPECTED}
            matches = {}
            observe_until = time.monotonic() + 30
            while time.monotonic() < observe_until and len(matches) < len(EXPECTED):
                try:
                    channel, line = messages.get(timeout=0.5)
                except queue.Empty:
                    if process.poll() is not None:
                        break
                    continue
                if channel != "out":
                    continue
                match = parse_tail_match(line, marker)
                if match:
                    matches[(match["method"], match["path"])] = match
            return results, matches
        finally:
            stop_tail(process)


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in {"review", "gate", "verify"},
            "Use review, gate or verify.")
    if sys.argv[1] == "gate":
        require(os.environ.get("TAIL_CONFIRMATION") == CONFIRMATION,
                "Exact tail-only consent phrase required.")
        main_sha()
        protected_environment()
        print("Owner-protected read-only tail gate verified. No Worker request sent.")
        return
    state = inspect_current()
    if sys.argv[1] == "review":
        print(json.dumps({**state, "mode": "read-only-check", "tail_started": False,
                          "probes_sent": 0}, ensure_ascii=False))
        return
    require(os.environ.get("TAIL_CONFIRMATION") == CONFIRMATION,
            "Exact tail-only consent phrase required.")
    protected_environment()
    marker = safe_marker()
    results, matches = run_tail_probe(marker, os.environ["GATEWAY_ROOT"])
    after = inspect_current()
    require(after["deployment_id"] == state["deployment_id"],
            "Worker deployment changed during the smoke test.")
    all_http = all(results.values())
    all_tailed = all(pair in matches for pair in EXPECTED)
    report = {
        **state,
        "mode": "candidate-version-tail-smoke",
        "http_get_health_ok": results[("GET", "/health")],
        "http_anonymous_post_forbidden": results[("POST", "/telegram-webhook")],
        "candidate_tail_filtered_event_count": len(matches),
        "candidate_version_filter": CANDIDATE_VERSION,
        "candidate_executed_via_tail_filter": all_tailed,
        "explicit_version_ids_reported":
            sorted({m["explicit_version_id"] for m in matches.values()
                    if m["explicit_version_id"] is not None}),
        "deployment_unchanged": True,
        "telegram_messages_sent": 0,
        "notion_writes": 0,
        "d1_writes": 0,
        "worker_deployments_modified": 0,
        "webhook_settings_modified": False,
        "all_checks_passed": all_http and all_tailed,
    }
    print(json.dumps(report, ensure_ascii=False))
    require(all_http and all_tailed,
            "Version-filtered live tail did not confirm both anonymous requests.")


if __name__ == "__main__":
    try:
        main()
    except Stop as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Read-only tail verification inconclusive. No deployments or writes were performed.",
              file=sys.stderr)
        sys.exit(1)
