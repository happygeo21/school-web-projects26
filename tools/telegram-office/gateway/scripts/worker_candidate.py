#!/usr/bin/env python3
"""Inspect or upload one inactive version. Never deploy, migrate, or write Notion."""
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import tomllib
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from cloudflare_preflight import WORKER, get_json
from cloudflare_review import DB_ID, D1_NAME, read_schema, schema_summary

SOURCE = "16c3caf5-6bc2-4758-aeae-7b9ba855b2a7"
CANDIDATE_SHA = "4d1746fdd82409a7d8a30287e94856f087e84cdc"
BASE_VERSION = "682b662b-2da1-4c0f-af5e-86c9bfd5e78a"
BASE_DEPLOYMENT = "d6e643fc-dedb-4f07-95da-c343d1dd9518"
BASE_SOURCE_HASH = "19970a2b90260a69ab4f942898f3db8973477fe7ad2b6c3eea04fb96e14c2a2e"
BASE_SECRETS = {"TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET", "NOTION_API_TOKEN"}
WEBHOOK = "https://geoteacher-telegram-gateway.ksoundmin.workers.dev/telegram-webhook"
ENVIRONMENT = "geoteacher-worker-staging"
UUID = r"[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}"


class Stop(RuntimeError):
    """Only fixed, public diagnostics may escape this script."""


def require(condition, message):
    if not condition:
        raise Stop(message)


def read_api(url, token, headers=None):
    request = Request(url, headers={"Authorization": "Bearer " + token, **(headers or {})})
    try:
        with urlopen(request, timeout=20) as response:
            return json.load(response)
    except HTTPError as error:
        raise Stop("Read-only authentication/access failed: HTTP " + str(error.code)) from None
    except URLError:
        raise Stop("Read-only network connection failed.") from None


def verify_environment(data):
    require(any(rule.get("type") == "required_reviewers" and rule.get("reviewers")
                for rule in data.get("protection_rules", [])), "Required environment reviewer is missing.")


def gate():
    repository = os.environ["GITHUB_REPOSITORY"]
    data = read_api("https://api.github.com/repos/" + repository + "/environments/" + ENVIRONMENT,
                    os.environ["GH_TOKEN"], {"Accept": "application/vnd.github+json"})
    verify_environment(data)
    print("Pre-existing reviewer-protected Worker staging environment verified.")


def webhook_status():
    # GET only. Never log the URL containing the bot token or Telegram error text.
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    require(bool(token), "Missing Telegram credential for read-only webhook inspection.")
    try:
        with urlopen(Request("https://api.telegram.org/bot" + token + "/getWebhookInfo"), timeout=15) as response:
            payload = json.load(response)
    except HTTPError as error:
        raise Stop("Telegram read-only access failed: HTTP " + str(error.code)) from None
    except URLError:
        raise Stop("Telegram read-only network connection failed.") from None
    require(payload.get("ok") is True, "Telegram webhook inspection failed.")
    info = payload["result"]
    updates = info.get("allowed_updates")
    # An explicitly empty list means Telegram defaults, including callback_query.
    callback = (not updates or "callback_query" in updates) if isinstance(updates, list) else None
    pending = info.get("pending_update_count")
    return {"url_matches": info.get("url") == WEBHOOK,
            "callback_query_allowed": callback,
            "message_allowed": (not updates or "message" in updates) if isinstance(updates, list) else None,
            "pending_update_count": pending if isinstance(pending, int) and not isinstance(pending, bool) else None,
            "last_error_present": bool(info.get("last_error_date")), "webhook_changed": False}


def context():
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    require(bool(token) and re.fullmatch(r"[a-fA-F0-9]{32}", account), "Missing read-only Cloudflare credentials.")
    return "/accounts/" + account, token


def config(root):
    data = tomllib.loads((root / "wrangler.production-candidate.toml").read_text())
    require(data.get("name") == WORKER and data.get("main") == "src/index.js", "Candidate Worker identity differs.")
    require(data.get("vars") == {"ADD_ENABLED": "false"}, "Candidate must keep ADD_ENABLED=false.")
    require(data.get("d1_databases") == [{"binding": "TASK_DB", "database_name": D1_NAME,
                "database_id": DB_ID, "migrations_dir": "migrations"}], "Candidate D1 binding differs.")
    require(data.get("compatibility_date") == "2026-11-03" and data.get("workers_dev") is True
                and data.get("preview_urls") is False, "Candidate runtime settings differ.")
    require(set(data) == {"name", "main", "compatibility_date", "workers_dev", "preview_urls", "observability", "vars", "d1_databases"},
            "Unreviewed configuration property found.")
    return data


def active(base, token):
    current = get_json(base + "/workers/scripts/" + WORKER + "/deployments?per_page=5", token)["deployments"][0]
    versions = current.get("versions", [])
    require(current.get("id") == BASE_DEPLOYMENT and len(versions) == 1
            and versions[0].get("version_id") == BASE_VERSION and versions[0].get("percentage") == 100,
            "Active deployment changed. Stop for a new review.")
    return current


def baseline(base, token, candidate):
    data = config(candidate)
    active(base, token)
    script = base + "/workers/scripts/" + WORKER
    version = get_json(script + "/versions/" + BASE_VERSION, token)
    bindings = version["resources"]["bindings"]
    require({b.get("name"): b.get("type") for b in bindings} == {name: "secret_text" for name in BASE_SECRETS},
            "Existing bindings changed. Stop for a new review.")
    source = get_json(base + "/workers/workers/" + WORKER + "/versions/" + BASE_VERSION + "?include=modules", token)
    modules = source.get("modules", [])
    require(len(modules) == 1 and hashlib.sha256(base64.b64decode(modules[0]["content_base64"], validate=True)).hexdigest() == BASE_SOURCE_HASH,
            "Existing source changed. Stop for a new review.")
    runtime = version["resources"]["script_runtime"]
    require(runtime.get("compatibility_date") == data["compatibility_date"] and not runtime.get("compatibility_flags"),
            "Existing compatibility settings differ.")
    settings = get_json(script + "/script-settings", token)
    observed = settings.get("observability") or {}
    wanted = data["observability"]
    require(all(observed.get(key) == wanted[key] for key in ["enabled", "head_sampling_rate"])
            and all((observed.get("logs") or {}).get(key) == value for key, value in wanted["logs"].items()),
            "Existing observability differs.")
    subdomain = get_json(script + "/subdomain", token)
    require(subdomain.get("enabled") is True and subdomain.get("previews_enabled") is False, "Existing URL settings differ.")
    database = get_json(base + "/d1/database/" + DB_ID, token)
    require(database.get("name") == D1_NAME and (database.get("uuid") or database.get("id")) == DB_ID, "D1 identity differs.")
    schema = schema_summary(read_schema(base, token), (candidate / "migrations/0001_task_approvals.sql").read_text())
    require(schema.get("state") == "already_matches", "D1 migration must already be verified. No migration will run.")
    return {"active_version": BASE_VERSION, "deployment_id": BASE_DEPLOYMENT, "traffic_percentage": 100,
            "existing_secret_names": sorted(BASE_SECRETS), "d1_schema": schema,
            "source_matches_previous_review": True, "rollback_version_readable": True}


def notion_schema(candidate, token):
    # No query of existing task rows and no page creation. Insert capability cannot
    # be proved through this GET; the owner must confirm capabilities in Notion UI.
    data = read_api("https://api.notion.com/v1/data_sources/" + SOURCE, token, {"Notion-Version": "2026-03-11"})
    program = "import fs from 'node:fs'; const m=await import(process.argv[1]); m.validateSchema(JSON.parse(fs.readFileSync(0,'utf8')));"
    result = subprocess.run(["node", "--input-type=module", "-e", program, (candidate / "src/task-add.js").as_uri()],
                            input=json.dumps(data), text=True, capture_output=True,
                            env=child_environment(), timeout=20)
    require(result.returncode == 0, "Writer read-only authentication/schema validation failed.")
    return {"writer_read_authentication": True, "target_schema_verified": True,
            "insert_capability_api_verified": False, "notion_pages_created": 0}


def child_environment():
    # Do not pass unrelated repository credentials, bot or Notion tokens to Node/npm.
    allowed = {"PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "SYSTEMROOT", "NODE_EXTRA_CA_CERTS",
               "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY",
               "http_proxy", "https_proxy", "no_proxy", "CLOUDFLARE_ACCOUNT_ID"}
    return {key: value for key, value in os.environ.items() if key in allowed}


def run_upload(arguments, **kwargs):
    # npm can spawn a Node child. On timeout stop the whole group before deleting
    # the memory-only secret/log directory; no detached upload may keep using it.
    process = subprocess.Popen(arguments, start_new_session=True, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, **kwargs)
    try:
        stdout, stderr = process.communicate(timeout=180)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.communicate()
        raise Stop("Upload timed out; candidate creation is uncertain. Inspect versions; do not retry automatically.") from None
    return subprocess.CompletedProcess(arguments, process.returncode, stdout, stderr)


def upload(candidate, writer, worker_token):
    # The CLI requires a file. Use runner tmpfs (not the checkout/disk/artifacts)
    # with restrictive permissions, capture CLI output, and delete in all exits.
    require(Path("/dev/shm").is_dir(), "Memory-backed private input is unavailable.")
    with tempfile.TemporaryDirectory(prefix="geoteacher-", dir="/dev/shm") as temporary:
        private = Path(temporary) / "secrets.json"
        with open(private, "x", opener=lambda path, flags: os.open(path, flags, 0o600)) as file:
            json.dump({"NOTION_WRITE_TOKEN": writer}, file)
        env = child_environment()
        env.update({"CLOUDFLARE_API_TOKEN": worker_token, "CI": "true", "WRANGLER_SEND_METRICS": "false",
                    "CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV": "false", "WRANGLER_LOG_PATH": temporary + "/wrangler.log",
                    "npm_config_logs_dir": temporary + "/npm-logs",
                    "NO_COLOR": "1"})
        result = run_upload(["npx", "--yes", "wrangler@4.157.0", "versions", "upload", "--config",
                         "wrangler.production-candidate.toml", "--secrets-file", str(private),
                         "--no-x-provision", "--no-x-auto-create", "--message", "GeoTeacher reviewed inactive candidate " + CANDIDATE_SHA],
                         cwd=candidate, env=env)
        require(result.returncode == 0, "Inactive upload failed; inspect version metadata before any retry. CLI output withheld.")
        matches = re.findall(r"Worker Version ID:\s*(" + UUID + ")", result.stdout)
        require(len(matches) == 1, "Upload response uncertain. Inspect versions; do not retry automatically.")
        return matches[0]


def candidate_bindings(version):
    bindings = version.get("resources", {}).get("bindings", [])
    indexed = {binding.get("name"): binding for binding in bindings}
    expected = BASE_SECRETS | {"NOTION_WRITE_TOKEN", "TASK_DB", "ADD_ENABLED"}
    require(len(bindings) == len(expected) and set(indexed) == expected, "Candidate binding names differ.")
    require(all(indexed[name].get("type") == "secret_text" for name in BASE_SECRETS | {"NOTION_WRITE_TOKEN"}),
            "Candidate encrypted Secret metadata differs.")
    require(indexed["TASK_DB"].get("type") == "d1" and indexed["TASK_DB"].get("id") == DB_ID, "Candidate D1 resource differs.")
    require(indexed["ADD_ENABLED"].get("type") == "plain_text" and indexed["ADD_ENABLED"].get("text") == "false",
            "Candidate ADD_ENABLED is not false.")
    require(version.get("resources", {}).get("script_runtime", {}).get("compatibility_date") == "2026-11-03",
            "Uploaded candidate compatibility differs.")
    return {"secret_names": sorted(BASE_SECRETS | {"NOTION_WRITE_TOKEN"}), "task_db_id": DB_ID, "add_enabled": False}


def verified_checkout(candidate, mode):
    actual = subprocess.run(["git", "-C", str(candidate), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    if mode == "inspect":
        # The review checks out the current main SHA, not the older fixed candidate SHA.
        expected = os.environ.get("REVIEW_MAIN_REF", "")
        require(bool(re.fullmatch(r"[a-f0-9]{40}", expected)) and actual == expected,
                "Read-only inspection checkout does not match the reviewed main SHA.")
    else:
        # The version upload still requires the exact immutable, previously reviewed candidate.
        require(actual == CANDIDATE_SHA, "Candidate commit differs from the reviewed merged PR.")
    return actual


def main():
    mode = sys.argv[1]
    if mode == "gate":
        gate()
        return
    require(mode in {"inspect", "stage"}, "Unsupported candidate operation.")
    candidate = Path(os.environ["CANDIDATE_ROOT"]).resolve()
    actual = verified_checkout(candidate, mode)
    base, token = context()
    report = baseline(base, token, candidate)
    report.update({"candidate_commit": actual, "mode": mode, "production_deployed": False, "d1_writes": False})
    if mode == "inspect":
        report["webhook"] = webhook_status()
    else:
        require(os.environ.get("NOTION_SCOPE_CONFIRMED") == "true", "Owner must confirm existing Notion Read/Insert-only scope.")
        writer = os.environ.get("NOTION_WRITE_TOKEN", "").strip()
        worker_token = os.environ.get("CLOUDFLARE_WORKER_STAGING_TOKEN", "").strip()
        require(bool(writer) and bool(worker_token), "Missing protected Notion/Worker staging Secret. No version uploaded.")
        latest = get_json(base + "/workers/scripts/" + WORKER + "/versions?per_page=1", token)["items"][0]["id"]
        require(latest == BASE_VERSION, "An unreviewed latest version exists. Stop before inheriting Secrets.")
        report["notion"] = notion_schema(candidate, writer)
        # Recheck active state immediately before the only write (inactive upload).
        active(base, token)
        version_id = upload(candidate, writer, worker_token)
        print(json.dumps({"uploaded_inactive_version_id": version_id, "verification_pending": True}))
        version = get_json(base + "/workers/scripts/" + WORKER + "/versions/" + version_id, token)
        require(version.get("id") == version_id, "Uploaded candidate identity differs.")
        report["candidate_version_id"] = version_id
        report["candidate_bindings"] = candidate_bindings(version)
    active(base, token)
    report["active_deployment_unchanged"] = True
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Stop as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
    except Exception:
        print("Candidate operation stopped; response/credentials withheld. Do not retry writes automatically.", file=sys.stderr)
        raise SystemExit(1)
