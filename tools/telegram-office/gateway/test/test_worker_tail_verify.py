"""Mock-only tests for protected version-filtered live-tail smoke."""
import io
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import worker_tail_verify as smoke
from worker_candidate import Stop


class TailProofSafetyTests(unittest.TestCase):
    def setUp(self):
        # Only synthetic tests bypass the source-level live transport hold.
        self.transport_gate = patch.object(smoke, "require_live_transport")
        self.transport_gate.start()
        self.addCleanup(self.transport_gate.stop)

    def event(self, pair, version=True, url=None):
        method, path = pair
        event = {"scriptName": smoke.WORKER, "event": {"request": {"method": method, "url": url or
                 smoke.ROOT + path + "?smoke=synthetic"}}}
        if version:
            event["scriptVersion"] = {"id": smoke.CANDIDATE_VERSION}
        return json.dumps(event)

    def test_proof_matrix_requires_each_endpoint_and_each_version(self):
        pairs = list(smoke.EXPECTED)
        for observed in [[], pairs[:1], pairs[1:], pairs]:
            for explicit in [False, True, "get_only"]:
                with self.subTest(observed=observed, explicit=explicit):
                    matches = {pair: smoke.parse_tail_match(self.event(
                               pair, explicit is True or (explicit == "get_only" and pair == pairs[0])), "synthetic")
                               for pair in observed}
                    stdout = io.StringIO()
                    with patch.object(smoke, "inspect_current", return_value={"deployment_id": smoke.DEPLOYMENT_ID}), \
                         patch.object(smoke, "protected_environment"), \
                         patch.object(smoke, "safe_marker", return_value="synthetic"), \
                         patch.object(smoke, "run_tail_probe", return_value=(dict.fromkeys(pairs, True), matches, {})), \
                         patch.dict(os.environ, {"TAIL_CONFIRMATION": smoke.CONFIRMATION, "GATEWAY_ROOT": str(ROOT)}), \
                         patch.object(sys, "argv", ["worker_tail_verify.py", "verify"]), \
                         patch("sys.stdout", stdout):
                        success = len(observed) == 2 and explicit is True
                        if success:
                            smoke.main()
                        else:
                            with self.assertRaises(Stop):
                                smoke.main()
                    report = json.loads(stdout.getvalue())
                    self.assertEqual(report["all_checks_passed"], success)
                    self.assertEqual(report["candidate_executed_via_tail_filter"], success)
                    self.assertEqual(len(report["candidate_tail_missing_endpoints"]), 2 - len(observed))
                    self.assertNotIn("synthetic", stdout.getvalue())

    def test_parser_rejects_ambiguous_urls_and_untrusted_shapes(self):
        base = smoke.ROOT + "/health"
        for url in [base + "?smoke=synthetic-extra", base + "?xsmoke=synthetic",
                    base + "?smoke=synthetic&smoke=other", base + "?smoke=synthetic#secret",
                    smoke.ROOT + ":444/health?smoke=synthetic",
                    "https://user:password@" + smoke.HOST + "/health?smoke=synthetic",
                    "https://outside.example/health?smoke=synthetic", "https://[invalid"]:
            with self.subTest(url=url):
                self.assertIsNone(smoke.parse_tail_match(self.event(("GET", "/health"), url=url), "synthetic"))
        for value in [{"event": "secret"}, {"event": {"request": []}}, []]:
            self.assertIsNone(smoke.parse_tail_match(json.dumps(value), "synthetic"))
        self.assertIsNone(smoke.parse_tail_match(
            "console.log GET " + base + "?smoke=synthetic - Ok", "synthetic"))

    def run_synthetic_stream(self, lines, connected=True, error=None, ended=False):
        # No CLI, sockets or real logs. A fake clock covers event delay/timeout.
        process = Mock()
        process.poll.return_value = None
        if ended:
            process.poll.side_effect = [None, 1]
        messages = smoke.queue.Queue()
        original_get = smoke.queue.Queue.get.__get__(messages)
        def delayed_get(*args, **kwargs):
            item = original_get(block=False)
            if item[1] is None:
                raise smoke.queue.Empty
            return item
        messages.get = delayed_get
        if connected:
            messages.put(("out", "Connected to " + smoke.WORKER + ", waiting for logs..."))
        for line in lines:
            messages.put(("out", line))
        ticks = iter(range(200))
        with patch.object(smoke.Path, "is_dir", return_value=True), \
             patch.object(smoke.tempfile, "TemporaryDirectory") as temporary, \
             patch.dict(os.environ, {"CLOUDFLARE_WORKER_STAGING_TOKEN": "SYNTHETIC_SECRET"}), \
             patch.object(smoke, "child_environment", return_value={}), \
             patch.object(smoke.subprocess, "Popen", return_value=process), \
             patch.object(smoke.threading, "Thread"), \
             patch.object(smoke.queue, "Queue", return_value=messages), \
             patch.object(smoke.time, "monotonic", side_effect=lambda: next(ticks)), \
             patch.object(smoke, "one_probe", return_value=True) as probe, \
             patch.object(smoke, "stop_tail") as stop, \
             patch("sys.stdout", new_callable=io.StringIO) as stdout, \
             patch("sys.stderr", new_callable=io.StringIO) as stderr:
            temporary.return_value.__enter__.return_value = "synthetic-memory"
            if error:
                with self.assertRaisesRegex(Stop, error):
                    smoke.run_tail_probe("synthetic", str(ROOT))
                result = None
            elif connected:
                result = smoke.run_tail_probe("synthetic", str(ROOT))
                self.assertEqual(probe.call_count, 2)
            else:
                with self.assertRaises(Stop) as caught:
                    smoke.run_tail_probe("synthetic", str(ROOT))
                self.assertNotIn("SYNTHETIC_SECRET", str(caught.exception))
                probe.assert_not_called()
                result = None
            stop.assert_called_once_with(process)
            temporary.return_value.__exit__.assert_called_once()
            self.assertEqual(stdout.getvalue() + stderr.getvalue(), "")
            return result

    def test_duplicate_and_delayed_events_do_not_replace_missing_endpoint(self):
        get = self.event(("GET", "/health"))
        post = self.event(("POST", "/telegram-webhook"))
        _, matches, counts = self.run_synthetic_stream([get, get, None, None, '{"logs":["SYNTHETIC_SECRET"]}', post])
        self.assertEqual(set(matches), set(smoke.EXPECTED))
        self.assertEqual(counts["stdout_lines"], 4)
        self.assertEqual(counts["unmatched_stdout_lines"], 1)
        _, matches, _ = self.run_synthetic_stream([get, get])
        self.assertEqual(set(matches), {("GET", "/health")})
        _, matches, _ = self.run_synthetic_stream([get] + [None] * 40 + [post])
        self.assertEqual(set(matches), {("GET", "/health")})

    def test_connection_failure_sends_no_probes_and_cleans_up(self):
        self.run_synthetic_stream(["Unauthorized SYNTHETIC_SECRET"], connected=False)

    def test_live_hold_blocks_gate_verify_and_direct_transport_before_io(self):
        self.transport_gate.stop()
        with patch.object(smoke, "inspect_current") as inspect, \
             patch.object(smoke, "main_sha") as sha, \
             patch.object(smoke, "protected_environment") as approval, \
             patch.object(smoke.subprocess, "Popen") as process, \
             patch.object(smoke, "urlopen") as request:
            for action in ["gate", "verify"]:
                with patch.object(sys, "argv", ["worker_tail_verify.py", action]):
                    with self.assertRaisesRegex(Stop, "^tail_transport_unverified$"):
                        smoke.main()
            with self.assertRaisesRegex(Stop, "^tail_transport_unverified$"):
                smoke.run_tail_probe("synthetic", str(ROOT))
            for mocked in [inspect, sha, approval, process, request]:
                mocked.assert_not_called()

    def test_json_single_multiline_chunked_reverse_and_sensitive_fields(self):
        events = [json.loads(self.event(pair)) for pair in reversed(list(smoke.EXPECTED))]
        for event in events:
            event["logs"] = [{"message": ["SYNTHETIC_SECRET { \\\" }", "Telegram data"]}]
            event["event"]["request"]["headers"] = {"cookie": "SYNTHETIC_COOKIE"}
        for indent in [None, 2]:
            text = "\n".join(json.dumps(event, indent=indent) for event in events)
            for width in [1, 17, len(text)]:
                decoder = smoke.TailJSONStream()
                matches = []
                for start in range(0, len(text), width):
                    matches.extend(decoder.feed(text[start:start + width], "synthetic"))
                decoder.finish()
                self.assertEqual([(m["method"], m["path"]) for m in matches], list(reversed(smoke.EXPECTED)))
                self.assertTrue(all(m["explicit_version_id"] == smoke.CANDIDATE_VERSION for m in matches))
                self.assertNotIn("SYNTHETIC", str(matches))
                self.assertEqual(decoder.buffer, [])

    def test_wrong_worker_and_nested_log_cannot_supply_identity(self):
        for worker in [None, "other-worker"]:
            event = json.loads(self.event(("GET", "/health")))
            event["scriptName"] = worker
            self.assertIsNone(smoke.parse_tail_match(json.dumps(event), "synthetic"))
        event = json.loads(self.event(("GET", "/health"), version=False))
        event["logs"] = [{"scriptVersion": {"id": smoke.CANDIDATE_VERSION}}]
        self.assertIsNone(smoke.parse_tail_match(json.dumps(event), "synthetic")["explicit_version_id"])

    def test_json_rejects_invalid_duplicate_deep_large_and_incomplete_data(self):
        cases = [('{"secret": invalid}', "tail_json_invalid"),
                 ('{"a":1,"a":2}', "tail_json_duplicate_key"),
                 ('{"a":NaN}', "tail_json_invalid"),
                 ('{"a":' + '[' * 40, "tail_json_too_deep"),
                 ('{"a":"' + 'x' * smoke.MAX_EVENT_BYTES, "tail_event_too_large"),
                 ('{"a":]', "tail_json_invalid")]
        for data, code in cases:
            decoder = smoke.TailJSONStream()
            with self.assertRaisesRegex(Stop, "^" + code + "$"):
                decoder.feed(data, "synthetic")
            self.assertEqual(decoder.buffer, [])
        decoder = smoke.TailJSONStream()
        decoder.feed('{"secret":', "synthetic")
        with self.assertRaisesRegex(Stop, "^tail_json_incomplete$"):
            decoder.finish()
        self.assertEqual(decoder.buffer, [])

    def test_pipe_limits_memory_and_closes_without_echo(self):
        for text, capacity in [("x" * (smoke.MAX_LINE_CHARS + 1), 2), ("one\ntwo\n", 1)]:
            pipe = io.StringIO(text)
            messages = smoke.queue.Queue(maxsize=capacity)
            stopped, failed = smoke.threading.Event(), smoke.threading.Event()
            with patch("sys.stdout", new_callable=io.StringIO) as output:
                smoke.stream_pipe(pipe, "out", messages, stopped, failed)
            self.assertTrue(failed.is_set())
            self.assertTrue(pipe.closed)
            self.assertLessEqual(messages.qsize(), capacity)
            self.assertEqual(output.getvalue(), "")

    def test_transport_errors_cleanup_and_late_conflict_cannot_pass(self):
        get = self.event(("GET", "/health"))
        post = self.event(("POST", "/telegram-webhook"))
        old = get.replace(smoke.CANDIDATE_VERSION, smoke.BASE_VERSION)
        self.run_synthetic_stream([get, post, old], error="version conflicts")
        self.run_synthetic_stream(['{"secret":invalid}'], error="tail_json_invalid")
        self.run_synthetic_stream(['{"secret":'], error="tail_json_incomplete")
        self.run_synthetic_stream([get, post], ended=True,
                                  error="tail_process_ended_during_observation")

    def test_probe_refuses_unapproved_inputs_redirects_and_http_failures(self):
        marker = "geoteacher-tail-verify-41823439479"
        with patch.object(smoke, "urlopen") as request:
            for method, path, value in [("GET", "https://outside.example", marker),
                                        ("GET", "/health", marker + "&secret=value")]:
                with self.assertRaises(Stop):
                    smoke.one_probe(method, path, value)
            request.assert_not_called()
        self.assertIsNone(smoke.NoProbeRedirect().redirect_request(
            None, None, 302, "redirect", {}, "https://outside.example"))
        for status in [302, 401, 500]:
            with patch.object(smoke, "urlopen", side_effect=HTTPError(
                    "https://outside.example?secret=value", status, "SYNTHETIC_SECRET", {}, io.BytesIO(b"secret"))):
                self.assertFalse(smoke.one_probe("GET", "/health", marker))

    def test_command_is_read_only_version_filtered_and_exact_worker(self):
        command = smoke.tail_command()
        self.assertEqual(command, [
            "npx", "--yes", "wrangler@4.157.0", "tail", "geoteacher-telegram-gateway",
            "--format", "json", "--version-id", "9d91cea3-c8d3-4322-902c-520fd7d4687b",
        ])
        self.assertNotIn("deploy", command)
        self.assertNotIn("upload", command)
        self.assertNotIn("rollback", command)
        self.assertNotIn("secret", " ".join(command).lower())

    def test_unique_marker_rejects_untrusted_input(self):
        with patch.dict(os.environ, {"GITHUB_RUN_ID": "41823439479"}):
            self.assertEqual(smoke.safe_marker(), "geoteacher-tail-verify-41823439479")
        for value in ["", "one", "4182&secret=foo", "1", "1234567890123456789"]:
            with patch.dict(os.environ, {"GITHUB_RUN_ID": value}):
                with self.assertRaises(Stop):
                    smoke.safe_marker()

    def test_parser_ignores_other_requests_and_mismatched_version(self):
        marker = "geoteacher-tail-verify-41823439479"
        request = {"url": "https://" + smoke.HOST + "/health?smoke=" + marker,
                   "method": "GET"}
        event = {"scriptName": smoke.WORKER, "event": {"request": request}, "scriptVersion": {"id": smoke.CANDIDATE_VERSION}}
        match = smoke.parse_tail_match(json.dumps(event), marker)
        self.assertEqual(match["path"], "/health")
        self.assertEqual(match["explicit_version_id"], smoke.CANDIDATE_VERSION)
        old = json.loads(json.dumps(event))
        old["scriptVersion"]["id"] = smoke.BASE_VERSION
        with self.assertRaises(Stop):
            smoke.parse_tail_match(json.dumps(old), marker)
        self.assertIsNone(smoke.parse_tail_match("not json", marker))
        self.assertIsNone(smoke.parse_tail_match("{}", marker))
        for altered in ["https://outside.example/health?smoke=" + marker,
                        "https://" + smoke.HOST + "/different?smoke=" + marker,
                        "https://" + smoke.HOST + "/health?smoke=other"]:
            event["event"]["request"]["url"] = altered
            self.assertIsNone(smoke.parse_tail_match(json.dumps(event), marker))

    def test_pretty_tail_lines_are_not_structured_version_evidence(self):
        marker = "geoteacher-tail-verify-41823439479"
        text_cases = [
            ("GET", "/health", "Ok"),
            ("POST", "/telegram-webhook", "Ok"),
        ]
        for method, path, outcome in text_cases:
            url = "https://" + smoke.HOST + path + "?smoke=" + marker
            sample = "\x1b[36m" + method + " " + url + " - " + outcome + " @ 11/5/2026" + "\x1b[0m"
            match = smoke.parse_tail_match(sample, marker)
            self.assertIsNone(match)
            self.assertNotIn(url, str(match))
        self.assertIsNone(smoke.parse_tail_match(
            "GET https://example.com/health?smoke=" + marker + " - Ok @ test", marker))
        self.assertIsNone(smoke.parse_tail_match(
            "POST https://" + smoke.HOST + "/other?smoke=" + marker + " - Ok @ test", marker))

    def test_tail_startup_diagnostics_only_report_fixed_safe_categories(self):
        default = {"created": False, "progress": False,
                   "auth_rejected": False, "cli_option_error": False,
                   "network_error": False, "out_lines": 0, "err_lines": 0}
        self.assertIn("tail_no_startup_output", smoke.tail_diagnostic(default))
        for name, category in [
            ("created", "tail_session_created_but_connection_unconfirmed"),
            ("auth_rejected", "tail_auth_or_scope_rejected"),
            ("cli_option_error", "tail_cli_option_rejected"),
            ("network_error", "tail_socket_or_network_error"),
        ]:
            with self.subTest(name=name):
                flags = dict(default, **{name: True, "out_lines": 2, "err_lines": 3})
                result = smoke.tail_diagnostic(flags)
                self.assertIn(category, result)
                self.assertIn("stdout_lines=2", result)
                self.assertNotIn("REDACTED", result)
        self.assertIn("tail_output_seen_but_no_connection_banner",
                      smoke.tail_diagnostic(dict(default, err_lines=1)))

    def test_parser_records_observation_without_claiming_missing_version(self):
        marker = "geoteacher-tail-verify-41823439479"
        event = {"outcome": "ok", "scriptName": smoke.WORKER,
                 "event": {"request": {
                     "url": "https://" + smoke.HOST + "/telegram-webhook?smoke=" + marker,
                     "method": "POST",
                 }}}
        match = smoke.parse_tail_match(json.dumps(event), marker)
        self.assertEqual((match["method"], match["path"]), ("POST", "/telegram-webhook"))
        self.assertIsNone(match["explicit_version_id"])

    def test_http_probes_are_anonymous_and_exactly_one_request_each(self):
        marker = "geoteacher-tail-verify-41823439479"
        seen = []
        class Handle:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self, limit): return b"ok"
        def fake_urlopen(request, timeout):
            seen.append(request)
            if request.get_method() == "POST":
                raise HTTPError(request.full_url, 403, "forbidden", {},
                                io.BytesIO(b"Forbidden"))
            return Handle()
        with patch.object(smoke, "urlopen", side_effect=fake_urlopen):
            self.assertTrue(smoke.one_probe("GET", "/health", marker))
            self.assertTrue(smoke.one_probe("POST", "/telegram-webhook", marker))
        self.assertEqual(len(seen), 2)
        for request in seen:
            self.assertTrue(request.full_url.startswith(smoke.ROOT))
            self.assertIn("smoke=" + marker, request.full_url)
            self.assertEqual(request.get_header("Cloudflare-workers-version-overrides"),
                             smoke.WORKER + '="' + smoke.CANDIDATE_VERSION + '"')
            self.assertIsNone(request.get_header("X-telegram-bot-api-secret-token"))
            self.assertIsNone(request.data)

    def test_preflight_requires_exact_existing_deployment_and_disabled_add(self):
        deploy = {"deployments": [{"id": smoke.DEPLOYMENT_ID,
                                   "versions": [
                                       {"version_id": smoke.BASE_VERSION, "percentage": 100},
                                       {"version_id": smoke.CANDIDATE_VERSION, "percentage": 0}
                                   ]}]}
        version = {"id": smoke.CANDIDATE_VERSION}
        def get(endpoint, token):
            return deploy if endpoint.endswith("/deployments?per_page=5") else version
        with patch.object(smoke, "main_sha", return_value="a" * 40), \
             patch.object(smoke, "context", return_value=("/accounts/test", "TOKEN")), \
             patch.object(smoke, "get_json", side_effect=get), \
             patch.object(smoke, "candidate_bindings", return_value={"add_enabled": False}):
            self.assertEqual(smoke.inspect_current()["existing_traffic_percent"], 100)
            deploy["deployments"][0]["versions"][1]["percentage"] = 0.01
            with self.assertRaises(Stop):
                smoke.inspect_current()

    def test_protected_verify_is_fail_closed_if_version_not_seen(self):
        baseline = {"deployment_id": smoke.DEPLOYMENT_ID}
        with patch.object(smoke, "inspect_current", return_value=baseline), \
             patch.object(smoke, "protected_environment"), \
             patch.object(smoke, "run_tail_probe", return_value=(
                 {("GET", "/health"): True, ("POST", "/telegram-webhook"): True},
                 {("GET", "/health"): {"explicit_version_id": None}},
                 {"stdout_lines": 1, "stderr_lines": 0, "unmatched_stdout_lines": 0})), \
             patch.object(smoke, "safe_marker", return_value="marker"), \
             patch.dict(os.environ, {
                 "TAIL_CONFIRMATION": smoke.CONFIRMATION,
                 "GATEWAY_ROOT": str(ROOT),
             }), patch.object(sys, "argv", ["worker_tail_verify.py", "verify"]):
            with self.assertRaises(Stop):
                smoke.main()

    def test_failed_tail_report_names_only_allowlisted_endpoints_and_safe_counts(self):
        state = {"deployment_id": smoke.DEPLOYMENT_ID}
        counts = {"stdout_lines": 3, "stderr_lines": 1, "unmatched_stdout_lines": 2}
        stdout = io.StringIO()
        with patch.object(smoke, "inspect_current", return_value=state), \
             patch.object(smoke, "protected_environment"), \
             patch.object(smoke, "run_tail_probe", return_value=(
                 {("GET", "/health"): True, ("POST", "/telegram-webhook"): True},
                 {("GET", "/health"): {"explicit_version_id": None}},
                 counts)), \
             patch.object(smoke, "safe_marker", return_value="private-probe-marker"), \
             patch.dict(os.environ, {
                 "TAIL_CONFIRMATION": smoke.CONFIRMATION,
                 "GATEWAY_ROOT": str(ROOT),
             }), patch.object(sys, "argv", ["worker_tail_verify.py", "verify"]), \
             patch("sys.stdout", stdout):
            with self.assertRaises(Stop):
                smoke.main()
        report = json.loads(stdout.getvalue())
        self.assertEqual(report["candidate_tail_observed_endpoints"], ["GET /health"])
        self.assertEqual(report["candidate_tail_missing_endpoints"], ["POST /telegram-webhook"])
        self.assertEqual(report["tail_observation_line_counts"], counts)
        self.assertFalse(report["all_checks_passed"])
        self.assertNotIn("private-probe-marker", stdout.getvalue())
        self.assertNotIn("smoke=", stdout.getvalue())

    def test_workflow_requires_manual_protected_environment_and_no_writes(self):
        root = ROOT.parents[2]
        filename = root / ".github/workflows/teacher-geoteacher-tail-smoke.yml"
        content = filename.read_text()
        self.assertIn("  workflow_dispatch:", content)
        self.assertIn("verify_tail:", content)
        self.assertIn("default: false", content)
        self.assertIn("environment: geoteacher-worker-staging", content)
        self.assertIn("VERIFY TAIL ONLY geoteacher-telegram-gateway", content)
        self.assertNotIn("\n  push:", content)
        self.assertNotIn("\n  pull_request:", content)
        self.assertNotIn("\n  schedule:", content)
        self.assertNotIn("NOTION_WRITE_TOKEN", content)
        self.assertNotIn("worker_zero_deploy.py stage", content)
        self.assertNotIn("wrangler versions deploy", content)


if __name__ == "__main__":
    unittest.main()
