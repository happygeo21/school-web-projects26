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
    # Pretty mode emits a human-readable connection banner and one request per
    # line. JSON mode can omit that banner and emit multi-line objects.
    # Parse events only in memory; never print a raw Tail line.
    return ["npx", "--yes", "wrangler@4.157.0", "tail", WORKER,
            "--format", "pretty", "--version-id", CANDIDATE_VERSION]


_ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


def parse_tail_match(raw_line, marker):
    """Parse pretty Tail request lines (or JSON) without exposing log contents."""
    line = _ANSI.sub("", raw_line).strip()
    explicit = None
    try:
        event = json.loads(line)
    except (ValueError, TypeError):
        event = None
    if isinstance(event, dict):
        request = (event.get("event") or {}).get("request") or {}
        if not isinstance(request, dict):
            return None
        url, method = request.get("url"), request.get("method")
        meta = event.get("scriptVersion") or (event.get("$workers") or {}).get("scriptVersion") or {}
        if isinstance(meta, dict):
            explicit = meta.get("id")
    else:
        # Wrangler --format pretty:
        # GET https://worker.example.workers.dev/health?smoke=<id> - Ok @ ...
        # POST https://worker.example.workers.dev/telegram-webhook?smoke=<id> - Ok @ ...
        match = re.search(r"(?:^|\s)(GET|POST)\s+(https://\S+)\s+-\s+[^\s]+", line, re.I)
        if not match:
            return None
        method, url = match.group(1).upper(), match.group(2)
    if not isinstance(url, str) or not isinstance(method, str):
        return None
    parts = urlsplit(url)
    if (parts.scheme != "https" or parts.hostname != HOST
            or ("smoke=" + marker) not in parts.query
            or (method, parts.path) not in EXPECTED):
        return None
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


def tail_diagnostic(flags):
    """Safe, fixed-category diagnostics only. Never reveal Wrangler log lines."""
    if flags["auth_rejected"]:
        reason = "tail_auth_or_scope_rejected"
    elif flags["cli_option_error"]:
        reason = "tail_cli_option_rejected"
    elif flags["network_error"]:
        reason = "tail_socket_or_network_error"
    elif flags["progress"]:
        reason = "tail_progress_seen_but_connection_unconfirmed"
    elif flags["created"]:
        reason = "tail_session_created_but_connection_unconfirmed"
    elif flags["out_lines"] or flags["err_lines"]:
        reason = "tail_output_seen_but_no_connection_banner"
    else:
        reason = "tail_no_startup_output"
    return ("Tail not ready [" + reason + "]"
            + " stdout_lines=" + str(flags["out_lines"])
            + " stderr_lines=" + str(flags["err_lines"]))


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
            flags = {"created": False, "progress": False,
                     "auth_rejected": False, "cli_option_error": False,
                     "network_error": False, "out_lines": 0, "err_lines": 0}
            deadline = time.monotonic() + 50
            while time.monotonic() < deadline and not ready:
                if process.poll() is not None:
                    raise Stop("Tail process ended before ready; "
                               + tail_diagnostic(flags) + "; no HTTP probes sent.")
                try:
                    channel, line = messages.get(timeout=0.5)
                except queue.Empty:
                    continue
                flags["out_lines" if channel == "out" else "err_lines"] += 1
                # Only exact allowlisted signals are retained. Never log a line.
                low = _ANSI.sub("", line).lower()
                flags["created"] |= "successfully created tail" in low
                flags["progress"] |= ("connected to" in low or "waiting for logs" in low)
                flags["auth_rejected"] |= any(word in low for word in (
                    "unauthorized", "forbidden", "permission denied",
                    "not authorized", "http 401", "http 403"))
                flags["cli_option_error"] |= any(word in low for word in (
                    "unknown argument", "unknown option", "unexpected argument"))
                flags["network_error"] |= any(word in low for word in (
                    "websocket error", "connection refused", "socket hang up"))
                ready = ("connected to " + WORKER.lower() in low
                         and "waiting for logs" in low)
            require(ready, tail_diagnostic(flags) + "; no HTTP probes sent.")
            results = {pair: one_probe(*pair, marker) for pair in EXPECTED}
            matches = {}
            # Counts only: never retain or emit raw request or Wrangler log lines.
            observation_counts = {
                "stdout_lines": 0,
                "stderr_lines": 0,
                "unmatched_stdout_lines": 0,
            }
            observe_until = time.monotonic() + 30
            while time.monotonic() < observe_until and len(matches) < len(EXPECTED):
                try:
                    channel, line = messages.get(timeout=0.5)
                except queue.Empty:
                    if process.poll() is not None:
                        break
                    continue
                if channel != "out":
                    observation_counts["stderr_lines"] += 1
                    continue
                observation_counts["stdout_lines"] += 1
                match = parse_tail_match(line, marker)
                if match:
                    matches[(match["method"], match["path"])] = match
                else:
                    observation_counts["unmatched_stdout_lines"] += 1
            return results, matches, observation_counts
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
    results, matches, observation_counts = run_tail_probe(marker, os.environ["GATEWAY_ROOT"])
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
        "candidate_tail_observed_endpoints":
            sorted(method + " " + path for method, path in matches),
        "candidate_tail_missing_endpoints":
            sorted(method + " " + path for method, path in EXPECTED if (method, path) not in matches),
        "tail_observation_line_counts": observation_counts,
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
