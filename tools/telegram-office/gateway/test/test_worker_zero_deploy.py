import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPTS))
import worker_zero_deploy as zero


class ZeroDeploymentSafetyTests(unittest.TestCase):
    def setUp(self):
        self.old = zero.BASE_VERSION
        self.new = zero.CANDIDATE_VERSION
        self.new_deployment = "11111111-2222-3333-4444-555555555555"

    def split(self, old_percent=100, new_percent=0):
        return {"id": self.new_deployment, "versions": [
            {"version_id": self.old, "percentage": old_percent},
            {"version_id": self.new, "percentage": new_percent},
        ]}

    def test_immutable_pinned_versions_and_noninteractive_zero_percent_command(self):
        args = zero.command()
        self.assertEqual(args[:5], ["npx", "--yes", "wrangler@4.157.0", "versions", "deploy"])
        self.assertIn(self.old + "@100%", args)
        self.assertIn(self.new + "@0%", args)
        self.assertEqual(args.count("--yes"), 2)  # npx + Wrangler confirmations
        self.assertIn("--name", args)
        self.assertEqual(args[args.index("--name") + 1], "geoteacher-telegram-gateway")
        self.assertNotIn("upload", args)
        self.assertNotIn("triggers", args)
        self.assertNotIn("rollback", args)
        self.assertNotIn("secret", " ".join(args).lower())
        self.assertEqual(zero.CANDIDATE_VERSION, "9d91cea3-c8d3-4322-902c-520fd7d4687b")

    def test_only_exact_old_hundred_new_zero_is_accepted(self):
        self.assertEqual(zero.exact_split(self.split()), self.new_deployment)
        rejected = [
            self.split(99.99, 0.01),
            self.split(0, 100),
            self.split(99, 1),
            {"id": self.new_deployment, "versions": [{"version_id": self.old, "percentage": 100}]},
            {"id": self.new_deployment, "versions": [
                {"version_id": self.old, "percentage": 100},
                {"version_id": self.old, "percentage": 0}]},
            {"id": self.new_deployment, "versions": [
                {"version_id": self.old, "percentage": "100"},
                {"version_id": self.new, "percentage": "0"}]},
            {"id": zero.BASE_DEPLOYMENT, "versions": self.split()["versions"]},
        ]
        for item in rejected:
            with self.subTest(item=item), self.assertRaises(zero.Stop):
                zero.exact_split(item)

    def test_only_owner_latest_main_and_manual_dispatch_allowed(self):
        sha = "9708cd5db72d3240ad8ca37ed4f05e65f7a3e9c8"
        env = {"GITHUB_EVENT_NAME": "workflow_dispatch",
               "GITHUB_REF": "refs/heads/main",
               "GITHUB_ACTOR": "happygeo21",
               "GITHUB_REPOSITORY": "happygeo21/school-web-projects26",
               "GITHUB_SHA": sha,
               "GH_TOKEN": "test-gh-token"}
        with patch.dict(os.environ, env, clear=True), \
             patch.object(zero, "read_api", return_value={"object": {"sha": sha}}):
            self.assertEqual(zero.main_sha(), sha)
            for key, value in [
                ("GITHUB_EVENT_NAME", "push"),
                ("GITHUB_REF", "refs/heads/audit"),
                ("GITHUB_ACTOR", "someone-else"),
                ("GITHUB_REPOSITORY", "someone-else/repo"),
                ("GITHUB_SHA", "not-a-sha"),
            ]:
                with patch.dict(os.environ, {key: value}), self.assertRaises(zero.Stop):
                    zero.main_sha()
        with patch.dict(os.environ, env, clear=True), \
             patch.object(zero, "read_api", return_value={"object": {"sha": "0"*40}}), \
             self.assertRaises(zero.Stop):
            zero.main_sha()

    def test_environment_requires_owner_review_and_prevents_admin_bypass(self):
        approved = {
            "can_admins_bypass": False,
            "prevent_self_review": False,
            "protection_rules": [{
                "type": "required_reviewers",
                "reviewers": [{"type": "User", "reviewer": {"login": "happygeo21"}}]
            }]
        }
        with patch.dict(os.environ, {"GH_TOKEN": "test-gh-token"}), \
             patch.object(zero, "read_api", return_value=approved):
            self.assertTrue(zero.protected_environment())
        for mutator in [
            lambda x: x.update({"can_admins_bypass": True}),
            lambda x: x.update({"prevent_self_review": True}),
            lambda x: x.update({"protection_rules": []}),
            lambda x: x["protection_rules"][0].update(
                {"reviewers": [{"reviewer": {"login": "someone-else"}}]})
        ]:
            candidate = json.loads(json.dumps(approved))
            mutator(candidate)
            with patch.dict(os.environ, {"GH_TOKEN": "test-gh-token"}), \
                 patch.object(zero, "read_api", return_value=candidate), \
                 self.assertRaises(zero.Stop):
                zero.protected_environment()

    def test_wrong_candidate_binding_or_replaced_old_active_fails_closed(self):
        raw = {"id": self.new, "resources": {
            "bindings": [{"name": k, "type": "secret_text"}
                         for k in zero.BASE_SECRETS | {"NOTION_WRITE_TOKEN"}]
                        + [{"name": "TASK_DB", "type": "d1", "id": zero.DB_ID},
                           {"name": "ADD_ENABLED", "type": "plain_text", "text": "false"}],
            "script_runtime": {"compatibility_date": "2026-11-03"}
        }}
        baseline = {"active_version": self.old,
                    "deployment_id": zero.BASE_DEPLOYMENT,
                    "traffic_percentage": 100}
        safe_webhook = {"url_matches": True, "message_allowed": True,
                        "callback_query_allowed": False, "last_error_present": False}
        paths = {
            "/versions/" + self.new: raw,
            "/versions?per_page=1": {"items": [{"id": self.new}]},
        }
        def fake_get(url, token):
            for key, value in paths.items():
                if url.endswith(key):
                    return value
            raise AssertionError("Unexpected remote access: " + url)
        env = {"CANDIDATE_ROOT": "/tmp"}
        with patch.dict(os.environ, env), \
             patch.object(zero, "main_sha", return_value="a"*40), \
             patch.object(zero, "context", return_value=("/accounts/test", "read-only")), \
             patch.object(zero, "baseline", return_value=baseline), \
             patch.object(zero, "permissions", return_value=safe_webhook), \
             patch.object(zero, "get_json", side_effect=fake_get):
            self.assertFalse(zero.inspect()["candidate_add_enabled"])
            raw["resources"]["bindings"][-1]["text"] = "true"
            with self.assertRaises(zero.Stop):
                zero.inspect()
            raw["resources"]["bindings"][-1]["text"] = "false"
            baseline["active_version"] = self.new
            with self.assertRaises(zero.Stop):
                zero.inspect()

    def test_stage_requires_confirmation_secret_and_one_explicit_attempt(self):
        env = {"ZERO_CONFIRMATION": zero.CONFIRMATION,
               "CLOUDFLARE_WORKER_STAGING_TOKEN": "private-worker-token",
               "CANDIDATE_ROOT": "/tmp"}
        with patch.dict(os.environ, env), \
             patch.object(zero, "protected_environment"), \
             patch.object(zero, "inspect", return_value={"existing_version": self.old}), \
             patch.object(zero, "run_upload", return_value=subprocess.CompletedProcess([], 0, "", "")) as run, \
             patch.object(zero, "postcheck", return_value=self.new_deployment), \
             patch.object(zero, "permissions", return_value={"url_matches": True}):
            zero.stage()
            run.assert_called_once()
            self.assertEqual(run.call_args.args[0], zero.command())
            self.assertEqual(run.call_args.kwargs["env"]["CLOUDFLARE_API_TOKEN"],
                             "private-worker-token")
            self.assertNotIn("NOTION_WRITE_TOKEN", run.call_args.kwargs["env"])
            self.assertNotIn("TELEGRAM_BOT_TOKEN", run.call_args.kwargs["env"])
        for bad in [{"ZERO_CONFIRMATION": "NOPE"}, {"CLOUDFLARE_WORKER_STAGING_TOKEN": ""}]:
            with patch.dict(os.environ, {**env, **bad}), \
                 patch.object(zero, "protected_environment"), \
                 patch.object(zero, "inspect", return_value={}), \
                 patch.object(zero, "run_upload") as run, self.assertRaises(zero.Stop):
                zero.stage()
                run.assert_not_called()
        with patch.dict(os.environ, env), \
             patch.object(zero, "protected_environment"), \
             patch.object(zero, "inspect", return_value={}), \
             patch.object(zero, "run_upload",
                          return_value=subprocess.CompletedProcess([], 1, "PRIVATE", "PRIVATE")) as run, \
             self.assertRaises(zero.Stop):
            zero.stage()
        self.assertEqual(run.call_count, 1)

    def test_no_automatic_retry_or_001_percent_fallback_for_api_rejection(self):
        env = {"ZERO_CONFIRMATION": zero.CONFIRMATION,
               "CLOUDFLARE_WORKER_STAGING_TOKEN": "private-worker-token",
               "CANDIDATE_ROOT": "/tmp"}
        with patch.dict(os.environ, env), \
             patch.object(zero, "protected_environment"), \
             patch.object(zero, "inspect", return_value={}), \
             patch.object(zero, "run_upload",
                          return_value=subprocess.CompletedProcess([], 1, "rejected", "")) as run, \
             self.assertRaises(zero.Stop) as caught:
            zero.stage()
        self.assertEqual(run.call_count, 1)
        self.assertNotIn("private-worker-token", str(caught.exception))
        self.assertNotIn("0.01%", " ".join(run.call_args.args[0]))

    def test_workflow_only_manual_and_protected_from_automatic_deploy(self):
        workflow = (Path(__file__).resolve().parents[4] / ".github/workflows"
                    / "teacher-geoteacher-zero-percent.yml").read_text()
        self.assertIn("  workflow_dispatch:", workflow)
        self.assertNotIn("\n  push:", workflow)
        self.assertNotIn("\n  schedule:", workflow)
        self.assertNotIn("\n  pull_request:", workflow)
        self.assertIn("default: false", workflow)
        self.assertIn("environment: geoteacher-worker-staging", workflow)
        self.assertIn("if: inputs.stage_zero && inputs.confirmation ==", workflow)
        self.assertIn("cancel-in-progress: false", workflow)
        self.assertNotIn("NOTION_WRITE_TOKEN", workflow)
        self.assertNotIn("workflow_call:", workflow)


if __name__ == "__main__":
    unittest.main()
