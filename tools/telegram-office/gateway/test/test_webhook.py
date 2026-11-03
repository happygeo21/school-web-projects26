"""No live Telegram access. Validate the actual registration helper payload."""
import importlib.util
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("webhook", Path(__file__).resolve().parents[1] / "configure_webhook.py")
webhook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(webhook)

class WebhookTests(unittest.TestCase):
    def test_install_preserves_pending_and_subscribes_to_callbacks(self):
        calls = []
        def request(method, payload=None):
            calls.append((method, payload))
            return {"url":"https://test.workers.dev/telegram-webhook"} if method == "getWebhookInfo" else True
        with patch.dict(os.environ, {"TELEGRAM_WORKER_URL":"https://test.workers.dev", "TELEGRAM_WEBHOOK_SECRET":"TEST_SECRET_ABC123456789"}), patch.object(sys, "argv", ["setup", "install"]), patch.object(webhook, "request", request), patch("builtins.print"):
            webhook.main()
        self.assertEqual([call[0] for call in calls], ["setWebhook", "getWebhookInfo"])
        payload = calls[0][1]
        self.assertEqual(payload["allowed_updates"], ["message", "callback_query"])
        self.assertIs(payload["drop_pending_updates"], False)
        self.assertEqual(payload["url"], "https://test.workers.dev/telegram-webhook")
        self.assertEqual(payload["max_connections"], 1)

    def test_status_never_reconfigures_or_polls_updates(self):
        with patch.object(sys, "argv", ["setup", "status"]), patch.object(webhook, "request", return_value={}) as request, patch("builtins.print"):
            webhook.main()
        request.assert_called_once_with("getWebhookInfo")

    def test_invalid_secret_never_calls_telegram(self):
        with patch.dict(os.environ, {"TELEGRAM_WORKER_URL":"https://test.workers.dev", "TELEGRAM_WEBHOOK_SECRET":"invalid!"}), patch.object(sys,"argv",["setup","install"]), patch.object(webhook,"request") as request:
            with self.assertRaises(RuntimeError): webhook.main()
        request.assert_not_called()

if __name__ == "__main__": unittest.main()
