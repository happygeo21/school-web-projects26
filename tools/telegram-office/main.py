#!/usr/bin/env python3
"""GeoTeacher Telegram alert hub, stdlib-only and read-only for source services."""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

SINCE = datetime.now(timezone.utc) - timedelta(hours=24)


def need(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Set GitHub Actions secret: {name}")
    return value


def api(url, headers=None, form=None):
    data = urlencode(form).encode() if form is not None else None
    request = Request(url, data=data, headers={
        "User-Agent": "GeoTeacher-Notifier/1.0", **(headers or {})
    })
    try:
        with urlopen(request, timeout=15) as response:
            return json.load(response)
    except HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code} from remote service") from exc
    except URLError as exc:
        raise RuntimeError("Remote service connection failed") from exc


def telegram(method, form=None):
    token = need("TELEGRAM_BOT_TOKEN")
    response = api(f"https://api.telegram.org/bot{token}/{method}", form=form)
    if not response.get("ok"):
        raise RuntimeError(f"Telegram {method} failed")
    return response["result"]


def send(chat_id, message):
    telegram("sendMessage", {"chat_id": str(chat_id), "text": message[:3800]})


def pair():
    updates = telegram("getUpdates", {"limit": 100, "timeout": 0})
    chats = {
        msg["chat"]["id"]
        for update in updates
        for msg in [update.get("message") or {}]
        if msg.get("chat", {}).get("type") == "private"
        and str(msg.get("text", "")).startswith("/start")
    }
    if len(chats) != 1:
        raise RuntimeError("Pairing needs exactly one private chat that sent /start.")
    chat_id = chats.pop()
    print(f"TELEGRAM_CHAT_ID={chat_id}")
    send(chat_id, "✅ GeoTeacher 알림봇 연결 성공! 채팅 ID를 GitHub Secrets에 저장하세요.")


def since(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")) >= SINCE


def github_events():
    repo = os.getenv("GITHUB_REPOSITORY", "happygeo21/school-web-projects26")
    headers = {"Accept": "application/vnd.github+json"}
    if os.getenv("GH_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GH_TOKEN']}"
    runs = api(f"https://api.github.com/repos/{repo}/actions/runs?per_page=40", headers).get("workflow_runs", [])
    failed = [
        run for run in runs
        if run.get("conclusion") == "failure"
        and str(run.get("id")) != os.getenv("GITHUB_RUN_ID", "")
        and run.get("updated_at") and since(run["updated_at"])
    ]
    prs = api(f"https://api.github.com/repos/{repo}/pulls?state=open&per_page=50", headers)
    recent_prs = [pr for pr in prs if pr.get("created_at") and since(pr["created_at"])]
    lines = []
    if failed:
        lines.append(f"🚨 GitHub 최근 24시간 실패 실행: {len(failed)}건")
    if recent_prs:
        lines.append(f"🔧 GitHub 최근 24시간 신규 PR: {len(recent_prs)}건")
    return lines


def notion_events():
    watches = os.getenv("NOTION_WATCH_PAGES", "").strip()
    if not watches:
        return []
    token = os.getenv("NOTION_API_TOKEN", "").strip()
    if not token:
        return ["⚠️ Notion 토큰이 등록되지 않았습니다."]
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2025-09-03",
        "Accept": "application/json",
    }
    changed = []
    errors = 0
    for item in watches.split(";"):
        if not item.strip():
            continue
        if "=" not in item:
            errors += 1
            continue
        name, page_id = (v.strip() for v in item.split("=", 1))
        page_id = page_id.replace("-", "")
        if not name or len(page_id) != 32 or any(c not in "0123456789abcdefABCDEF" for c in page_id):
            errors += 1
            continue
        try:
            page = api(f"https://api.notion.com/v1/pages/{page_id}", headers)
            if page.get("last_edited_time") and since(page["last_edited_time"]):
                changed.append(name)
        except RuntimeError:
            errors += 1
    lines = []
    if changed:
        lines.append(f"📝 Notion 변경된 감시 페이지: {len(changed)}개")
        lines.append(" · ".join(changed[:5]))
    if errors:
        lines.append(f"⚠️ Notion 접근/설정 오류: {errors}건")
    return lines


def scan():
    chat_id = need("TELEGRAM_CHAT_ID")
    lines = []
    for label, callback in (("GitHub", github_events), ("Notion", notion_events)):
        try:
            lines.extend(callback())
        except RuntimeError:
            lines.append(f"⚠️ {label} 점검 실패: 연결 권한과 설정 확인")
    if not lines:
        print("No meaningful changes; no alert sent.")
        return
    send(chat_id, "📬 GeoTeacher 업무 알림\n\n" + "\n".join(lines)
         + "\n\n상세 내용은 원본 서비스에서 확인하세요.")
    print("Sent privacy-minimized Telegram notification.")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "scan"
    if mode == "pair":
        pair()
    elif mode == "test":
        send(need("TELEGRAM_CHAT_ID"), "✅ GeoTeacher 알림봇 테스트 성공!")
        print("Test message sent.")
    elif mode == "scan":
        scan()
    else:
        raise RuntimeError("Mode must be pair, test, or scan.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
