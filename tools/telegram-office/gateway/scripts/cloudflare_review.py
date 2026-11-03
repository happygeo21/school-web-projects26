#!/usr/bin/env python3
"""Read deployed version modules and D1 schema; emit allowlisted metadata only.

Reuses PR #17 authentication and GET helper. The only POST is a fixed SELECT
against sqlite_schema, never user input or application rows. No writes/deploys.
"""
import base64
import hashlib
import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from cloudflare_preflight import API_ROOT, WORKER, D1_NAME, get_json

DB_ID = "59dbd391-34fa-48c6-aa28-6b4240c2ff77"
KNOWN_BINDINGS = {"TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET", "NOTION_API_TOKEN", "NOTION_WRITE_TOKEN", "TASK_DB", "ADD_ENABLED", "TELEGRAM_SENDER_ID"}
SCHEMA_QUERY = "SELECT type, name, sql FROM sqlite_schema WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' ORDER BY type,name"
EXPECTED_COLUMNS = {"id", "update_id", "owner", "title", "due", "schema_json", "expires_at", "state", "page_id", "page_url"}

def attempt(callback):
    try:
        return callback(), {"readable": True}
    except RuntimeError as error:
        # Only our fixed error labels/status numbers, never remote response text.
        code = re.search(r"HTTP (\d{3})", str(error))
        return None, {"readable": False, "http_status": int(code[1]) if code else None}
    except (ValueError, KeyError, TypeError):
        return None, {"readable": False, "invalid_response": True}

def binding_summary(bindings):
    if not isinstance(bindings, list):
        return {"readable": False}
    known = sorted(({"name": b["name"], "type": b.get("type") if b.get("type") in {"secret_text","plain_text","d1","json","kv_namespace","service"} else "other"} for b in bindings if isinstance(b, dict) and b.get("name") in KNOWN_BINDINGS), key=lambda b: b["name"])
    return {"readable": True, "known": known, "other_binding_count": len(bindings)-len(known), "task_db_present": any(b["name"]=="TASK_DB" for b in known)}

def compare_modules(modules, roots):
    if not isinstance(modules, list) or not modules:
        return {"available": False}
    reports = []
    for module in modules:
        raw = base64.b64decode(module["content_base64"], validate=True)
        # Do not emit remote module names, source, snippets, or source maps.
        matches = []
        for label, root in roots.items():
            for filename in ["index.js", "task-add.js"]:
                local = root / "src" / filename
                if local.is_file():
                    reference = local.read_bytes()
                    if raw == reference: matches.append(label+":"+filename+":exact")
                    elif raw.replace(b"\r\n",b"\n").strip() == reference.replace(b"\r\n",b"\n").strip(): matches.append(label+":"+filename+":line_endings_or_edges")
        reports.append({"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "reference_matches": matches})
    return {"available": True, "module_count": len(reports), "modules": reports}

def schema_summary(rows, expected_sql):
    if not isinstance(rows, list): raise ValueError("Invalid schema")
    table = next((r for r in rows if r.get("type")=="table" and r.get("name")=="task_approvals"), None)
    other = sum(r.get("type")=="table" and r.get("name") not in {"task_approvals","d1_migrations","_cf_KV"} for r in rows)
    if table is None: return {"state":"not_applied", "other_table_count":other, "migration_safe_to_consider":other==0}
    actual = table.get("sql") or ""
    normalize = lambda s: re.sub(r"\s+", "", s).rstrip(";").lower()
    expected_table = expected_sql[expected_sql.index("CREATE TABLE"):expected_sql.index("CREATE INDEX")].strip()
    expiry_index = any(r.get("type")=="index" and r.get("name")=="task_approvals_expiry" and normalize(r.get("sql") or "")==normalize("CREATE INDEX task_approvals_expiry ON task_approvals(state, expires_at)") for r in rows)
    exact = normalize(actual)==normalize(expected_table)
    return {"state":"already_matches" if exact and expiry_index else "schema_mismatch", "table_definition_matches":exact, "expiry_index_matches":expiry_index, "other_table_count":other, "skip_creation":True}

def read_schema(base, token):
    req = Request(API_ROOT+base+"/d1/database/"+DB_ID+"/query", data=json.dumps({"sql":SCHEMA_QUERY}).encode(), headers={"Authorization":"Bearer "+token,"Content-Type":"application/json","User-Agent":"GeoTeacher-Cloudflare-Review/1.0"}, method="POST")
    try:
        with urlopen(req, timeout=20) as response: data=json.load(response)
    except HTTPError as error: raise RuntimeError("D1 schema HTTP "+str(error.code)) from None
    except URLError: raise RuntimeError("D1 schema network unavailable") from None
    if not data.get("success") or not isinstance(data.get("result"),list) or len(data["result"])!=1 or data["result"][0].get("success") is not True: raise RuntimeError("D1 schema response invalid")
    return data["result"][0].get("results")

def main():
    token=os.getenv("CLOUDFLARE_API_TOKEN","").strip()
    account=os.getenv("CLOUDFLARE_ACCOUNT_ID","").strip()
    if not token or not re.fullmatch(r"[a-fA-F0-9]{32}",account): raise RuntimeError("Missing configured Cloudflare credentials")
    roots={label:Path(os.environ[key]) for label,key in [("main","REVIEW_MAIN_ROOT"),("pr16","REVIEW_CANDIDATE_ROOT")]}
    migration=roots["pr16"]/"migrations/0001_task_approvals.sql"
    expected=migration.read_text()
    base="/accounts/"+account
    script=base+"/workers/scripts/"+WORKER
    deployment=get_json(script+"/deployments?per_page=5",token)
    current=deployment.get("deployments",[])[0]
    report={"mode":"READ_ONLY", "source_writes":False, "deployment_id":current["id"],"serving_versions":[],"account_free_plan_verified":False,"expected_d1_id":DB_ID,"migration_sha256":hashlib.sha256(migration.read_bytes()).hexdigest()}
    versions, version_access=attempt(lambda:get_json(script+"/versions?per_page=100",token))
    listed=(versions.get("items",[]) if isinstance(versions,dict) else versions) or []
    retained={x.get("id") for x in listed if isinstance(x,dict)}
    report["version_history_access"]=version_access
    for serving in current.get("versions",[]):
        vid=serving["version_id"]
        metadata, meta_access=attempt(lambda:get_json(script+"/versions/"+vid,token))
        entry={"version_id":vid,"percentage":serving.get("percentage"),"metadata_access":meta_access,"retained_in_last_100":vid in retained,"rollback_executed":False}
        if metadata:
            resources=metadata.get("resources",{})
            runtime=resources.get("script_runtime") or {}
            entry["bindings"]=binding_summary(resources.get("bindings"))
            entry["compatibility_date"]=runtime.get("compatibility_date")
            entry["compatibility_flags"]=runtime.get("compatibility_flags")
        version, access=attempt(lambda:get_json(base+"/workers/workers/"+WORKER+"/versions/"+vid+"?include=modules",token))
        entry["source_access"]=access
        if version:
            if version.get("id")!=vid: raise RuntimeError("Version identity mismatch")
            entry["source_comparison"]=compare_modules(version.get("modules"),roots)
            entry["version_bindings"]=binding_summary(version.get("bindings"))
            entry["compatibility_date"]=version.get("compatibility_date",entry.get("compatibility_date"))
        report["serving_versions"].append(entry)
    settings, settings_access=attempt(lambda:get_json(script+"/script-settings",token))
    report["settings_access"]=settings_access
    if settings:
        obs=settings.get("observability") or {}
        report["observability"]={key:obs[key] for key in ["enabled","head_sampling_rate"] if isinstance(obs.get(key),(bool,int,float))}
        logs=obs.get("logs") or {}
        report["observability"]["logs"]={key:logs[key] for key in ["enabled","invocation_logs","head_sampling_rate"] if isinstance(logs.get(key),(bool,int,float))}
    subdomain,subdomain_access=attempt(lambda:get_json(script+"/subdomain",token))
    report["subdomain_access"]=subdomain_access
    if subdomain: report["subdomain"]={key:subdomain[key] for key in ["enabled","previews_enabled"] if isinstance(subdomain.get(key),bool)}
    subscriptions,subscription_access=attempt(lambda:get_json(base+"/subscriptions",token))
    report["subscription_access"]=subscription_access
    # Do not dump billing objects or unrelated products. Only exact known plan names.
    if isinstance(subscriptions,list):
        plan_names=[str((x.get("rate_plan") or {}).get("public_name", "")) for x in subscriptions if isinstance(x,dict)]
        report["workers_paid_plan_detected"]=any(n in {"Workers Paid","Workers Paid Plan","Workers Standard"} for n in plan_names)
        report["account_free_plan_verified"]=any(n in {"Workers Free","Workers Free Plan"} for n in plan_names) and not report["workers_paid_plan_detected"]
    db,db_access=attempt(lambda:get_json(base+"/d1/database/"+DB_ID,token))
    report["d1_metadata_access"]=db_access
    if db:
        if db.get("name")!=D1_NAME or (db.get("uuid") or db.get("id"))!=DB_ID: raise RuntimeError("D1 identity mismatch")
        report["d1_identity_verified"]=True
        report["d1_size_bytes"]=db.get("file_size") if isinstance(db.get("file_size"),int) else None
    rows,schema_access=attempt(lambda:read_schema(base,token))
    report["d1_schema_access"]=schema_access
    if rows is not None: report["d1_schema"]=schema_summary(rows,expected)
    # Ensure active deployment did not move while source was being compared.
    after=get_json(script+"/deployments?per_page=5",token)
    report["deployment_unchanged_during_read"]=after.get("deployments",[])[0].get("id")==current["id"]
    serialized=json.dumps(report,ensure_ascii=False,indent=2)
    print(serialized)
    output=Path(os.getenv("REVIEW_REPORT_PATH","cloudflare-review.json"))
    output.write_text(serialized+"\n")

if __name__=="__main__":
    try: main()
    except Exception:
        # Never emit traceback, API response, environment, or private source.
        print("READ-ONLY REVIEW FAILED: invalid metadata, local references, or connectivity",file=__import__('sys').stderr)
        raise SystemExit(1)
