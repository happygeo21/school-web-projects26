import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import worker_candidate as candidate


class WorkerCandidateSafetyTests(unittest.TestCase):
    def version(self):
        bindings = [{"name": name, "type": "secret_text"} for name in candidate.BASE_SECRETS | {"NOTION_WRITE_TOKEN"}]
        bindings += [{"name": "TASK_DB", "type": "d1", "id": candidate.DB_ID},
                     {"name": "ADD_ENABLED", "type": "plain_text", "text": "false"}]
        return {"resources": {"bindings": bindings, "script_runtime": {"compatibility_date": "2026-11-03"}}}

    def test_candidate_requires_preserved_encrypted_secrets_and_exact_binding(self):
        version = self.version()
        self.assertFalse(candidate.candidate_bindings(version)["add_enabled"])
        version["resources"]["bindings"][0]["type"] = "plain_text"
        with self.assertRaises(candidate.Stop):
            candidate.candidate_bindings(version)

    def test_enabled_add_or_different_database_stops_candidate_verification(self):
        for name, key, value in [("ADD_ENABLED", "text", "true"), ("TASK_DB", "id", "wrong")]:
            with self.subTest(name=name):
                version = self.version()
                next(binding for binding in version["resources"]["bindings"] if binding["name"] == name)[key] = value
                with self.assertRaises(candidate.Stop):
                    candidate.candidate_bindings(version)

    def test_changed_active_deployment_stops_before_upload(self):
        with patch.object(candidate, "get_json", return_value={"deployments": [{"id": "changed", "versions": []}]}):
            with self.assertRaises(candidate.Stop):
                candidate.active("account", "private-token")

    def test_environment_without_reviewer_is_rejected(self):
        for data in [{}, {"protection_rules": [{"type": "required_reviewers", "reviewers": []}]}]:
            with self.assertRaises(candidate.Stop):
                candidate.verify_environment(data)
        candidate.verify_environment({"protection_rules": [{"type": "required_reviewers", "reviewers": [{"type": "User"}]}]})

    def test_callback_permission_is_read_from_get_only(self):
        for allowed, expected in [(["message"], False), (["message", "callback_query"], True), ([], True), (None, None)]:
            with self.subTest(allowed=allowed):
                response = {"ok": True, "result": {"url": candidate.WEBHOOK, "pending_update_count": 0}}
                if allowed is not None:
                    response["result"]["allowed_updates"] = allowed
                with patch.dict(os.environ, {"TELEGRAM_BOT_TOKEN": "test-private-token"}), \
                     patch.object(candidate, "urlopen") as request:
                    request.return_value.__enter__.return_value = io.StringIO(json.dumps(response))
                    result = candidate.webhook_status()
                    self.assertIs(result["callback_query_allowed"], expected)
                    self.assertEqual(request.call_args.args[0].get_method(), "GET")
                    self.assertNotIn("test-private-token", json.dumps(result))

    def test_upload_only_versions_without_provision_and_removes_private_file(self):
        private_paths = []
        def run(arguments, **kwargs):
            self.assertEqual(arguments[3:5], ["versions", "upload"])
            self.assertIn("--no-x-provision", arguments)
            self.assertNotIn("deploy", arguments)
            private = Path(arguments[arguments.index("--secrets-file") + 1])
            private_paths.append(private)
            self.assertEqual(private.stat().st_mode & 0o777, 0o600)
            self.assertEqual(json.loads(private.read_text()), {"NOTION_WRITE_TOKEN": "private-notion-test"})
            self.assertNotIn("private-notion-test", " ".join(arguments))
            self.assertNotIn("NOTION_WRITE_TOKEN", kwargs["env"])
            return subprocess.CompletedProcess(arguments, 0, "Worker Version ID: " + candidate.BASE_VERSION, "")
        with patch.object(candidate.subprocess, "run", side_effect=run):
            self.assertEqual(candidate.upload(Path("/tmp"), "private-notion-test", "private-worker-test"), candidate.BASE_VERSION)
        self.assertTrue(private_paths)
        self.assertFalse(private_paths[0].exists())
        self.assertFalse(private_paths[0].parent.exists())

    def test_upload_timeout_is_not_retried_and_removes_private_input(self):
        paths = []
        def timeout(arguments, **kwargs):
            paths.append(Path(arguments[arguments.index("--secrets-file") + 1]))
            raise subprocess.TimeoutExpired(arguments, 180, output="private-notion-test")
        with patch.object(candidate.subprocess, "run", side_effect=timeout) as process:
            with self.assertRaises(candidate.Stop) as error:
                candidate.upload(Path("/tmp"), "private-notion-test", "private-worker-test")
            self.assertNotIn("private-notion-test", str(error.exception))
            self.assertEqual(process.call_count, 1)
        self.assertFalse(paths[0].exists())

    def test_writer_authentication_only_gets_target_schema_and_reuses_worker_validator(self):
        with patch.object(candidate, "read_api", return_value={"schema": "fixture"}) as request, \
             patch.object(candidate.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, "", "")) as process:
            result = candidate.notion_schema(Path("/tmp"), "private-notion-test")
            self.assertEqual(request.call_args.args[0], "https://api.notion.com/v1/data_sources/" + candidate.SOURCE)
            self.assertFalse(result["insert_capability_api_verified"])
            self.assertEqual(result["notion_pages_created"], 0)
            self.assertIn("validateSchema", process.call_args.args[0][3])


if __name__ == "__main__":
    unittest.main()
