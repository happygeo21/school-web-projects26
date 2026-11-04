#!/usr/bin/env python3
"""Fail-closed, approval-gated 100% old + 0% candidate Worker deployment.

No command in this module writes Notion/D1, edits Telegram webhook, uploads a new
Worker version, or moves traffic to the candidate. An authorized stage command
creates exactly one 100%/0% deployment, then verifies the remote record.
"""
import json
import os
from pathlib import Path
import re
import sys
import tempfile

from cloudflare_preflight import WORKER, get_json
from worker_candidate import (
    BASE_DEPLOYMENT, BASE_VERSION, CANDIDATE_SHA, BASE_SECRETS, DB_ID,
    Stop, baseline, candidate_bindings, child_environment, context,
    read_api, require, run_upload, webhook_status,
)

CANDIDATE_VERSION = "9d91cea3-c8d3-4322-902c-520fd7d4687b"
OWNER = "happygeo21"
ENVIRONMENT = "geoteacher-worker-staging"
CONFIRMATION = "ZERO ONLY geoteacher-telegram-gateway"
UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$")


def main_sha():
    """The action must run from current main, not an old workflow or PR branch."""
    require(os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch",
            "Only manual workflow_dispatch is allowed.")
    require(os.environ.get("GITHUB_REF") == "refs/heads/main",
            "Only main can run this Worker review.")
    require(os.environ.get("GITHUB_ACTOR") == OWNER,
            "Only the repository owner may request this operation.")
    repository = os.environ.get("GITHUB_REPOSITORY", "")
    require(repository == OWNER + "/school-web-projects26",
            "Unexpected GitHub repository.")
    trigger_sha = os.environ.get("GITHUB_SHA", "")
    require(bool(re.fullmatch(r"[0-9a-f]{40}", trigger_sha)),
            "Invalid GitHub checkout SHA.")
    token = os.environ.get("GH_TOKEN", "")
    require(bool(token), "Missing GitHub read token.")
    data = read_api("https://api.github.com/repos/" + repository + "/git/ref/heads/main",
                    token, {"Accept": "application/vnd.github+json"})
    require(data.get("object", {}).get("sha") == trigger_sha,
            "Main changed since workflow dispatch. Stop instead of deploying older approval.")
    return trigger_sha


def protected_environment():
    """Verify the configured human approval rule; GitHub performs the actual gate."""
    data = read_api(
        "https://api.github.com/repos/" + OWNER
        + "/school-web-projects26/environments/" + ENVIRONMENT,
        os.environ["GH_TOKEN"],
        {"Accept": "application/vnd.github+json"},
    )
    rules = data.get("protection_rules") or []
    owner_rules = [
        rule for rule in rules
        if rule.get("type") == "required_reviewers"
        and any(
            isinstance(r, dict) and r.get("type") == "User"
            and (r.get("reviewer") or {}).get("login") == OWNER
            for r in rule.get("reviewers", [])
        )
    ]
    require(len(owner_rules) == 1, "Environment lacks exactly one owner review rule.")
    # GitHub GET /environments places prevent_self_review on the rule itself.
    require(owner_rules[0].get("prevent_self_review") is False,
            "Single-owner review must be allowed.")
    require(data.get("can_admins_bypass") is False,
            "Admin bypass must be disabled for staging.")
    policy = data.get("deployment_branch_policy") or {}
    require(policy.get("custom_branch_policies") is True
            and policy.get("protected_branches") is False,
            "Staging must restrict deployment to selected branches.")
    branches = read_api(
        "https://api.github.com/repos/" + OWNER
        + "/school-web-projects26/environments/" + ENVIRONMENT
        + "/deployment-branch-policies",
        os.environ["GH_TOKEN"],
        {"Accept": "application/vnd.github+json"},
    )
    configured = branches.get("branch_policies") or []
    require(len(configured) == 1 and configured[0].get("name") == "main"
            and configured[0].get("type") == "branch",
            "Staging must allow exactly the main branch.")
    return True


def permissions():
    info = webhook_status()  # Only Telegram getWebhookInfo; never setWebhook.
    require(info["url_matches"] and info["message_allowed"] is True,
            "Existing Telegram webhook has changed.")
    require(info["callback_query_allowed"] is False,
            "Telegram allowed_updates changed. Stop for a fresh review.")
    require(not info["last_error_present"],
            "Existing Telegram webhook reports an error.")
    return info


def inspect():
    """Read only the two exact versions, current deployment, D1, and webhook."""
    sha = main_sha()
    base, token = context()  # Existing read-only Cloudflare credential.
    candidate_root = Path(os.environ["CANDIDATE_ROOT"]).resolve()
    report = baseline(base, token, candidate_root)
    script = base + "/workers/scripts/" + WORKER
    current = get_json(script + "/versions/" + CANDIDATE_VERSION, token)
    require(current.get("id") == CANDIDATE_VERSION,
            "Reviewed candidate ID does not exist.")
    bindings = candidate_bindings(current)
    latest = get_json(script + "/versions?per_page=1", token)["items"][0]["id"]
    require(latest == CANDIDATE_VERSION,
            "A newer Worker version exists. Re-review before any deployment.")
    info = permissions()
    require(report["active_version"] == BASE_VERSION
            and report["deployment_id"] == BASE_DEPLOYMENT
            and report["traffic_percentage"] == 100,
            "Original 100% production baseline changed.")
    return {
        "checked_main_sha": sha,
        "worker_name": WORKER,
        "existing_version": BASE_VERSION,
        "existing_deployment_id": BASE_DEPLOYMENT,
        "candidate_version": CANDIDATE_VERSION,
        "old_traffic_percent": 100,
        "candidate_traffic_percent": 0,
        "candidate_add_enabled": bindings["add_enabled"],
        "candidate_task_db_id_matches": bindings["task_db_id"] == DB_ID,
        "existing_secrets_preserved": set(BASE_SECRETS).issubset(bindings["secret_names"]),
        "telegram_message_allowed": info["message_allowed"],
        "telegram_callback_unchanged": info["callback_query_allowed"] is False,
        "cloudflare_deployed": False,
    }


def command():
    """Pinned CLI, two pinned version IDs, no implicit traffic split or fallback."""
    return [
        "npx", "--yes", "wrangler@4.157.0", "versions", "deploy",
        BASE_VERSION + "@100%", CANDIDATE_VERSION + "@0%",
        "--name", WORKER,
        "--yes", "--message",
        "GeoTeacher approved old 100 percent candidate zero percent",
    ]


def exact_split(deployment):
    require(isinstance(deployment, dict), "Missing deployment metadata.")
    versions = deployment.get("versions") or []
    require(len(versions) == 2, "Expected exactly two deployed Worker versions.")
    by_id = {}
    for item in versions:
        version = item.get("version_id")
        percent = item.get("percentage")
        require(version not in by_id and isinstance(percent, (int, float))
                and not isinstance(percent, bool), "Invalid deployment version entry.")
        by_id[version] = percent
    require(by_id == {BASE_VERSION: 100, CANDIDATE_VERSION: 0},
            "Unexpected traffic percentages. No automatic retry or traffic change.")
    require(bool(UUID.fullmatch(deployment.get("id", "")))
            and deployment["id"] != BASE_DEPLOYMENT,
            "Expected a new deployment ID with exact 100/0 split.")
    return deployment["id"]


def postcheck():
    base, token = context()
    data = get_json(base + "/workers/scripts/" + WORKER
                    + "/deployments?per_page=5", token)
    require(isinstance(data.get("deployments"), list) and data["deployments"],
            "Cannot verify Worker deployments.")
    return exact_split(data["deployments"][0])


def stage():
    """After human approval, create one deployment and verify. Never retry."""
    require(os.environ.get("ZERO_CONFIRMATION") == CONFIRMATION,
            "Missing exact 0% deployment confirmation.")
    protected_environment()
    before = inspect()  # Re-read every precondition immediately before the write.
    worker_token = os.environ.get("CLOUDFLARE_WORKER_STAGING_TOKEN", "").strip()
    require(bool(worker_token), "Missing dedicated protected Worker edit credential.")
    require(Path("/dev/shm").is_dir(), "Private memory log space unavailable.")
    # All CLI messages are captured/suppressed. No secret is used as a CLI argument.
    with tempfile.TemporaryDirectory(prefix="geoteacher-zero-", dir="/dev/shm") as temporary:
        child = child_environment()
        child.update({
            "CLOUDFLARE_API_TOKEN": worker_token,
            "WRANGLER_SEND_METRICS": "false",
            "CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV": "false",
            "WRANGLER_LOG_PATH": temporary + "/wrangler.log",
            "npm_config_logs_dir": temporary + "/npm-logs",
            "CI": "true", "NO_COLOR": "1",
        })
        result = run_upload(command(), env=child, cwd=os.environ["CANDIDATE_ROOT"])
    require(result.returncode == 0,
            "0% deployment command failed; inspect Cloudflare before any retry. "
            "Never substitute a nonzero candidate percentage.")
    # If output is lost or metadata disagrees, leave it for manual review. Never
    # repeat the deploy, reset the Worker, or silently roll traffic back.
    deployment_id = postcheck()
    after_webhook = permissions()
    require(after_webhook["url_matches"], "Webhook verification failed.")
    print(json.dumps({
        **before,
        "cloudflare_deployed": True,
        "new_deployment_id": deployment_id,
        "split_exact": True,
        "production_traffic_still_on_old_version": True,
        "notion_page_writes": 0,
        "d1_writes": 0,
        "webhook_changes": 0,
        "next_step": "version-override smoke test requires separate approval",
    }, ensure_ascii=False))


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in {"review", "gate", "stage"},
            "Allowed modes: review, gate, stage.")
    mode = sys.argv[1]
    if mode == "gate":
        main_sha()
        require(os.environ.get("ZERO_CONFIRMATION") == CONFIRMATION,
                "Wrong staging confirmation.")
        protected_environment()
        print("Owner-protected staging gate verified; no deployment performed.")
    elif mode == "review":
        print(json.dumps(inspect(), ensure_ascii=False, indent=2))
    else:
        stage()


if __name__ == "__main__":
    try:
        main()
    except Stop as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("Safe stop: metadata/CLI result uncertain. Do not retry or "
              "change traffic until Cloudflare state is independently checked.",
              file=sys.stderr)
        sys.exit(1)
