"""Mock-only tests for protected version-filtered live-tail smoke."""
import io
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import worker_tail_verify as smoke
from worker_candidate import Stop


class TailProofSafetyTests(unittest.TestCase):
    def test_command_is_read_only_version_filtered_and_exact_worker(self):
        command = smoke.tail_command()
        self.assertEqual(command, [
            "npx", "--yes", "wrangler@4.157.0", "tail", "geoteacher-telegram-gateway",
            "--format", "pretty", "--version-id", "9d91cea3-c8d3-4322-902c-520fd7d4687b",
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
        event = {"event": {"request": request}, "scriptVersion": {"id": smoke.CANDIDATE_VERSION}}
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

    def test_pretty_tail_lines_match_fixed_url_without_echoing_raw_logs(self):
        marker = "geoteacher-tail-verify-41823439479"
        text_cases = [
            ("GET", "/health", "Ok"),
            ("POST", "/telegram-webhook", "Ok"),
        ]
        for method, path, outcome in text_cases:
            url = "https://" + smoke.HOST + path + "?smoke=" + marker
            sample = "\x1b[36m" + method + " " + url + " - " + outcome + " @ 11/5/2026" + "\x1b[0m"
            match = smoke.parse_tail_match(sample, marker)
            self.assertEqual(match["method"], method)
            self.assertEqual(match["path"], path)
            self.assertIsNone(match["explicit_version_id"])
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

    def test_parser_can_use_tail_filter_when_json_version_omitted(self):
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
