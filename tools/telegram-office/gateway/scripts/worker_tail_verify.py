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
from urllib.request import HTTPRedirectHandler, Request, build_opener

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
MAX_EVENT_BYTES = 65536
MAX_LINE_CHARS = 16384
MAX_PENDING_LINES = 64
MAX_JSON_DEPTH = 32


def require_live_transport():
    # Deliberate source-level hold, not an environment-variable bypass.
    # Pinned Wrangler JSON has no connection banner or guaranteed version ID;
    # it also reconnects internally. See the runbook before changing this gate.
    raise Stop("tail_transport_unverified")


class NoProbeRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


# Never forward the override header or marker to a redirected destination.
urlopen = build_opener(NoProbeRedirect()).open


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
    # Proposed JSON transport, blocked by require_live_transport until its
    # readiness, version metadata and no-reconnect contract are verified.
    return ["npx", "--yes", "wrangler@4.157.0", "tail", WORKER,
            "--format", "json", "--version-id", CANDIDATE_VERSION]


_ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


class TailJSONStream:
    """Bounded object framing; raw content exists only in memory until parsed."""
    def __init__(self):
        self.clear()

    def clear(self):
        self.buffer = []
        self.stack = []
        self.in_string = False
        self.escape = False
        self.size = 0

    def feed(self, chunk, marker):
        matches = []
        try:
            for char in chunk:
                if not self.stack:
                    if char.isspace():
                        continue
                    require(char == "{", "tail_json_invalid")
                self.buffer.append(char)
                self.size += len(char.encode("utf-8"))
                require(self.size <= MAX_EVENT_BYTES, "tail_event_too_large")
                if self.in_string:
                    if self.escape:
                        self.escape = False
                    elif char == "\\":
                        self.escape = True
                    elif char == '"':
                        self.in_string = False
                elif char == '"':
                    self.in_string = True
                elif char in "{[":
                    self.stack.append(char)
                    require(len(self.stack) <= MAX_JSON_DEPTH, "tail_json_too_deep")
                elif char in "}]":
                    require(bool(self.stack) and self.stack.pop() == ("{" if char == "}" else "["),
                            "tail_json_invalid")
                    if not self.stack:
                        raw = "".join(self.buffer)
                        self.clear()
                        match = parse_tail_match(raw, marker, strict=True)
                        if match:
                            matches.append(match)
            return matches
        except Exception:
            self.clear()
            raise

    def finish(self):
        incomplete = bool(self.buffer)
        self.clear()
        require(not incomplete, "tail_json_incomplete")


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "tail_json_duplicate_key")
        result[key] = value
    return result


def reject_json_constant(value):
    raise Stop("tail_json_invalid")


def parse_tail_match(raw_line, marker, strict=False):
    """Conditional JSON contract, not evidence that the backend emits an ID."""
    require(len(raw_line.encode("utf-8")) <= MAX_EVENT_BYTES, "tail_event_too_large")
    line = raw_line.strip()
    explicit = None
    try:
        event = json.loads(line, object_pairs_hook=unique_object,
                           parse_constant=reject_json_constant)
    except (ValueError, TypeError):
        require(not strict, "tail_json_invalid")
        return None
    if isinstance(event, dict):
        if event.get("scriptName") != WORKER:
            return None
        envelope = event.get("event")
        if not isinstance(envelope, dict):
            return None
        request = envelope.get("request")
        if not isinstance(request, dict):
            return None
        url, method = request.get("url"), request.get("method")
        meta = event.get("scriptVersion")
        if isinstance(meta, dict):
            explicit = meta.get("id")
    else:
        return None
    if not isinstance(url, str) or not isinstance(method, str):
        return None
    try:
        parts = urlsplit(url)
    except ValueError:
        return None
    if (parts.scheme != "https" or parts.netloc != HOST
            or parts.query != "smoke=" + marker or parts.fragment
            or (method, parts.path) not in EXPECTED):
        return None
    if explicit is not None and explicit != CANDIDATE_VERSION:
        raise Stop("Tail event version conflicts with the requested candidate.")
    return {"method": method, "path": parts.path,
            "explicit_version_id": explicit if explicit == CANDIDATE_VERSION else None}


def one_probe(method, path, marker):
    require((method, path) in EXPECTED, "Probe endpoint not allowed.")
    require(bool(re.fullmatch(r"geoteacher-tail-verify-[0-9]{4,18}", marker)),
            "Probe marker not allowed.")
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


def stream_pipe(pipe, channel, messages, stopped, failed):
    try:
        while not stopped.is_set():
            line = pipe.readline(MAX_LINE_CHARS + 1)
            if not line:
                break
            if len(line) > MAX_LINE_CHARS:
                failed.set()
                break
            try:
                messages.put_nowait((channel, line))
            except queue.Full:
                failed.set()
                break
    except (OSError, ValueError):
        failed.set()
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
    require_live_transport()
    require(Path("/dev/shm").is_dir(), "Memory-backed temporary logs unavailable.")
    worker_token = os.environ.get("CLOUDFLARE_WORKER_STAGING_TOKEN", "").strip()
    require(bool(worker_token), "Protected Worker tail credential unavailable.")
    with tempfile.TemporaryDirectory(prefix="geoteacher-tail-", dir="/dev/shm") as private:
        env = child_environment()
        env.update({"CLOUDFLARE_API_TOKEN": worker_token,
                    "CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV": "false",
                    "WRANGLER_SEND_METRICS": "false",
                    "WRANGLER_WRITE_LOGS": "false",
                    "WRANGLER_LOG_PATH": private + "/wrangler.log",
                    "npm_config_logs_dir": private + "/npm",
                    "CI": "true",
                    "NO_COLOR": "1"})
        process = subprocess.Popen(tail_command(), cwd=root, env=env,
                                   start_new_session=True, text=True, bufsize=1,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        messages = queue.Queue(maxsize=MAX_PENDING_LINES)
        stopped, failed = threading.Event(), threading.Event()
        readers = []
        decoder = TailJSONStream()
        try:
            for channel, pipe in [("out", process.stdout), ("err", process.stderr)]:
                reader = threading.Thread(target=stream_pipe,
                                          args=(pipe, channel, messages, stopped, failed), daemon=True)
                readers.append(reader)
                reader.start()
            ready = False
            flags = {"created": False, "progress": False,
                     "auth_rejected": False, "cli_option_error": False,
                     "network_error": False, "out_lines": 0, "err_lines": 0}
            deadline = time.monotonic() + 50
            while time.monotonic() < deadline and not ready:
                require(not failed.is_set(), "tail_stream_limit_or_read_error")
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
            require(not failed.is_set(), "tail_stream_limit_or_read_error")
            results = {pair: one_probe(*pair, marker) for pair in EXPECTED}
            matches = {}
            # Counts only: never retain or emit raw request or Wrangler log lines.
            observation_counts = {
                "stdout_lines": 0,
                "stderr_lines": 0,
                "unmatched_stdout_lines": 0,
            }
            observe_until = time.monotonic() + 30
            while time.monotonic() < observe_until:
                require(not failed.is_set(), "tail_stream_limit_or_read_error")
                try:
                    channel, line = messages.get(timeout=0.5)
                except queue.Empty:
                    if process.poll() is not None:
                        raise Stop("tail_process_ended_during_observation")
                    continue
                if channel != "out":
                    observation_counts["stderr_lines"] += 1
                    continue
                observation_counts["stdout_lines"] += 1
                parsed = decoder.feed(line, marker)
                for match in parsed:
                    matches[(match["method"], match["path"])] = match
                if not parsed:
                    observation_counts["unmatched_stdout_lines"] += 1
            decoder.finish()
            require(not failed.is_set(), "tail_stream_limit_or_read_error")
            return results, matches, observation_counts
        finally:
            stopped.set()
            try:
                stop_tail(process)
            finally:
                for reader in readers:
                    reader.join(timeout=1)
                decoder.clear()
                while True:
                    try:
                        messages.get_nowait()
                    except queue.Empty:
                        break


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in {"review", "gate", "verify"},
            "Use review, gate or verify.")
    if sys.argv[1] in {"gate", "verify"}:
        require_live_transport()
    if sys.argv[1] == "gate":
        require(os.environ.get("TAIL_CONFIRMATION") == CONFIRMATION,
                "Exact tail-only consent phrase required.")
        main_sha()
        protected_environment()
        print("Owner-protected read-only tail gate verified. No Worker request sent.")
        return
    state = inspect_current()
    if sys.argv[1] == "review":
        print(json.dumps({"deployment_split_verified": True, "mode": "read-only-check", "tail_started": False,
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
    all_http = all(results.get(pair) is True for pair in EXPECTED)
    all_tailed = all(pair in matches for pair in EXPECTED)
    all_versions = all(matches.get(pair, {}).get("explicit_version_id") == CANDIDATE_VERSION
                       for pair in EXPECTED)
    report = {
        "mode": "candidate-version-tail-smoke",
        "tail_connected": True,
        "deployment_split_verified": True,
        "http_get_health_ok": results[("GET", "/health")],
        "http_anonymous_post_forbidden": results[("POST", "/telegram-webhook")],
        "candidate_tail_filtered_event_count": len(matches),
        "candidate_tail_observed_endpoints":
            sorted(method + " " + path for method, path in matches),
        "candidate_tail_missing_endpoints":
            sorted(method + " " + path for method, path in EXPECTED if (method, path) not in matches),
        "tail_observation_line_counts": observation_counts,
        "candidate_executed_via_tail_filter": all_tailed and all_versions,
        "candidate_version_confirmed_for_both_requests": all_versions,
        "candidate_get_version_matches": matches.get(("GET", "/health"), {}).get("explicit_version_id") == CANDIDATE_VERSION,
        "candidate_post_version_matches": matches.get(("POST", "/telegram-webhook"), {}).get("explicit_version_id") == CANDIDATE_VERSION,
        "candidate_version_missing_endpoints":
            sorted(method + " " + path for method, path in EXPECTED
                   if matches.get((method, path), {}).get("explicit_version_id") != CANDIDATE_VERSION),
        "deployment_unchanged": True,
        "telegram_messages_sent": 0,
        "notion_writes": 0,
        "d1_writes": 0,
        "worker_deployments_modified": 0,
        "webhook_settings_modified": False,
        "all_checks_passed": all_http and all_tailed and all_versions,
        "failure_code": ("http_probe_failed" if not all_http else
                         "tail_request_missing" if not all_tailed else
                         "tail_version_unconfirmed" if not all_versions else None),
    }
    print(json.dumps(report, ensure_ascii=False))
    require(all_http and all_tailed and all_versions,
            "Tail did not confirm both anonymous requests with explicit candidate version IDs.")


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
