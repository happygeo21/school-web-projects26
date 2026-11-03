/**
 * GeoTeacher Telegram free command gateway.
 * Private-chat-only. No student information, no AI API, no database writes.
 * GitHub Actions continues to send outbound alerts through the SAME bot.
 */
const REPOSITORY = "happygeo21/school-web-projects26";
const DASHBOARD = "https://app.notion.com/p/400abbdcebdc812f8aa3c1e6bf8b8b10";
const GITHUB_ACTIONS = "https://github.com/" + REPOSITORY + "/actions/workflows/teacher-telegram-notifications.yml";
const PUBLIC_MAP = "https://happygeo21.github.io/school-web-projects26/veteransgeo/public.html";

function response(message, status = 200) {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

async function statusMessage() {
  let status = "최신 작업 상태를 확인하지 못했습니다.";
  let checked = false;
  try {
    const url = "https://api.github.com/repos/" + REPOSITORY
      + "/actions/workflows/teacher-telegram-notifications.yml/runs?per_page=1";
    const result = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "GeoTeacher-Office-Gateway",
      },
    });
    if (result.ok) {
      const data = await result.json();
      checked = true;
      const run = data.workflow_runs?.[0];
      if (run) {
        const values = { success: "성공", failure: "실패", cancelled: "취소", skipped: "건너뜀" };
        status = run.status === "completed"
          ? (values[run.conclusion] || "종료됨")
          : "진행 중 또는 대기 중";
        status = "최근 알림 워크플로 결과: " + status;
      } else {
        status = "최근 알림 워크플로 실행 기록이 없습니다.";
      }
    }
  } catch {
    // No claims of success if the GitHub API is unavailable.
  }
  if (!checked) {
    try {
      const badge = await fetch(GITHUB_ACTIONS + "/badge.svg?branch=main", {
        headers: { "User-Agent": "GeoTeacher-Office-Gateway" },
      });
      if (badge.ok) {
        const svg = await badge.text();
        const state = svg.match(/<title>[^<]* - (passing|failing|pending|running|cancelled|no status)<\/title>/i)?.[1]?.toLowerCase();
        const labels = { passing: "성공", failing: "실패", pending: "대기 중", running: "진행 중", cancelled: "취소", "no status": "기록 없음" };
        if (state && labels[state]) {
          status = "GitHub 공개 실행 배지(main): " + labels[state]
            + "\n※ 배지 정보는 캐시되어 실제 실행보다 늦게 반영될 수 있습니다.";
        }
      }
    } catch {
      // Keep the honest unknown state when both public sources are unavailable.
    }
  }
  return "🔎 GeoTeacher 시스템 상태\n\n"
    + "Telegram 명령 수신: 정상\n"
    + status
    + "\n\nGitHub 실행 내역:\n" + GITHUB_ACTIONS;
}


const NOTION_TASK_SOURCE = "16c3caf5-6bc2-4758-aeae-7b9ba855b2a7";

// Summaries contain counts only. Titles, body text and original links are never used.
function kstDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null
    : new Date(parsed.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

export function summarizeTasks(rows, now = new Date()) {
  const today = kstDate(now);
  const weekEnd = kstDate(new Date(now.getTime() + 7 * 86400000));
  const counts = { open: 0, today: 0, overdue: 0, next7: 0 };
  for (const row of rows) {
    if (row.archived || row.in_trash || row.is_archived) continue;
    const p = row.properties || {};
    if (p["정보 등급"]?.select?.name !== "일반 업무") continue;
    if (p["교사 완료 확인"]?.checkbox === true) continue;
    if (["완료", "제외"].includes(p["진행 상태"]?.status?.name)) continue;
    counts.open++;
    const raw = p["마감일시"]?.date?.start;
    if (!raw) continue;
    const due = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : kstDate(raw);
    if (!due) continue;
    if (due < today) counts.overdue++;
    else if (due === today) counts.today++;
    else if (due <= weekEnd) counts.next7++;
  }
  return counts;
}

async function todayMessage(env) {
  const footer = "\n\n" + DASHBOARD
    + "\n\n아침 브리핑 원문과 Notion 알림은 기존 Notion에서만 유지합니다.";
  if (!env.NOTION_API_TOKEN) {
    return "📋 교사 AI 업무운영실\n\nNotion 업무 건수: 읽기 전용 연결 설정 대기" + footer;
  }
  try {
    const url = new URL("https://api.notion.com/v1/data_sources/" + NOTION_TASK_SOURCE + "/query");
    for (const property of ["진행 상태", "마감일시", "교사 완료 확인", "정보 등급"]) {
      url.searchParams.append("filter_properties", property);
    }
    const rows = [];
    let cursor;
    let incomplete = false;
    for (let page = 0; page < 3; page++) {
      const body = {
        page_size: 100,
        filter: { and: [
          { property: "정보 등급", select: { equals: "일반 업무" } },
          { property: "교사 완료 확인", checkbox: { equals: false } },
          { property: "진행 상태", status: { does_not_equal: "완료" } },
          { property: "진행 상태", status: { does_not_equal: "제외" } },
        ] },
      };
      if (cursor) body.start_cursor = cursor;
      const result = await fetch(url.toString(), {
        method: "POST", // Notion query is read-only; no page writes.
        headers: {
          Authorization: "Bearer " + env.NOTION_API_TOKEN,
          "Notion-Version": "2026-03-11",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!result.ok) {
        const hint = [401, 403, 404].includes(result.status)
          ? "읽기 권한·업무함 연결 설정 확인 필요"
          : result.status === 429 ? "조회 제한으로 잠시 후 다시 시도"
          : "일시적 조회 오류";
        return "📋 교사 AI 업무운영실\n\nNotion 업무 건수: " + hint + footer;
      }
      const data = await result.json();
      if (!Array.isArray(data.results) || typeof data.has_more !== "boolean") throw new Error("Invalid query response");
      rows.push(...data.results);
      incomplete ||= data.request_status?.type === "incomplete";
      if (!data.has_more) break;
      if (page === 2) { incomplete = true; break; }
      if (!data.next_cursor) throw new Error("Missing cursor");
      cursor = data.next_cursor;
    }
    const c = summarizeTasks(rows);
    return "📋 Notion 업무 건수 (한국시간 기준)\n\n"
      + "미완료: " + c.open + "건\n"
      + "오늘 마감: " + c.today + "건\n"
      + "기한 경과: " + c.overdue + "건\n"
      + "내일부터 7일 이내 마감: " + c.next7 + "건\n"
      + "대상: 일반 업무 · 완료·제외 및 교사 완료 확인 항목 제외"
      + (incomplete ? "\n※ 일부 항목만 집계되었습니다. 전체 건수는 Notion에서 확인하세요." : "")
      + footer;
  } catch {
    return "📋 교사 AI 업무운영실\n\nNotion 업무 건수를 확인하지 못했습니다. 잠시 후 다시 시도하세요." + footer;
  }
}

async function commandResponse(input, env) {
  const first = input.trim().split(/\s+/)[0].toLowerCase().split("@")[0];
  if (["/start", "/help", "도움말", "명령어"].includes(first)) {
    return "🤖 GeoTeacher 업무봇 (무료 명령 모드)\n\n"
      + "/ping — 연결 확인\n"
      + "/status — GitHub 알림 실행 상태\n"
      + "/today — Notion 업무 건수·바로가기\n"
      + "/projects — 주요 프로젝트 링크\n"
      + "/aside — Aside 무료 사용 안내\n\n"
      + "현재는 기본 명령만 처리합니다. ChatGPT·Aside가 자동으로 대화 내용을 실행하지는 않습니다.";
  }
  if (["/ping", "연결", "핑"].includes(first)) {
    return "✅ Telegram 명령 수신 정상\n기존 GitHub 자동 알림 기능과 별개로 작동합니다.";
  }
  if (["/status", "상태", "점검"].includes(first)) return await statusMessage();
  if (["/today", "/brief", "오늘", "업무"].includes(first)) {
    return await todayMessage(env);
  }
  if (["/projects", "프로젝트"].includes(first)) {
    return "🗂 주요 프로젝트\n\nGitHub: https://github.com/" + REPOSITORY
      + "\n기억의 좌표 공개 지도: " + PUBLIC_MAP
      + "\n업무운영실: " + DASHBOARD
      + "\n\n추가 프로젝트 연결은 후속 단계에서 확장합니다.";
  }
  if (["/aside", "어사이드"].includes(first)) {
    return "🖥 Aside 무료 운영\n\n"
      + "Aside Channels 원격 제어는 현재 요금제에서 제한됩니다.\n"
      + "브라우저 점검은 Windows의 Aside 앱에서 직접 실행하세요.\n"
      + "이 봇은 작업 요청을 Aside에 자동 전달하지 않습니다.\n"
      + "클라우드 명령을 추가할 때에는 별도로 승인·권한 검증을 적용하겠습니다.";
  }
  return "요청을 실행하지 않았습니다. 지금은 무료 기본 명령만 지원합니다.\n"
    + "사용 가능한 명령은 /help 로 확인하세요.\n"
    + "학생의 이름, 성적, 연락처 등 개인정보는 입력하지 마세요.";
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health") return response("ok");
    if (request.method !== "POST" || path !== "/telegram-webhook") {
      return response("Not found", 404);
    }
    const required = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_CHAT_ID"];
    if (required.some((key) => !env[key])) return response("Not configured", 503);
    const signature = request.headers.get("x-telegram-bot-api-secret-token");
    if (!signature || signature !== env.TELEGRAM_WEBHOOK_SECRET) {
      return response("Forbidden", 403);
    }
    if (Number(request.headers.get("content-length") || 0) > 16000) {
      return response("Payload too large", 413);
    }
    let update;
    try {
      const raw = await request.text();
      if (raw.length > 16000) return response("Payload too large", 413);
      update = JSON.parse(raw);
    } catch {
      return response("Invalid JSON", 400);
    }
    const message = update.message;
    if (!message || message.chat?.type !== "private") return response("ok");
    const owner = String(env.TELEGRAM_CHAT_ID);
    if (String(message.chat.id) !== owner || String(message.from?.id) !== owner) {
      return response("ok"); // Silent response to unknown users.
    }
    if (typeof message.text !== "string" || !message.text.trim()) return response("ok");
    const reply = await commandResponse(message.text, env);
    const endpoint = "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage";
    const result = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: owner, text: reply.slice(0, 3900), disable_web_page_preview: true }),
    });
    if (!result.ok) return response("Telegram delivery failed", 502);
    return response("ok");
  },
};
