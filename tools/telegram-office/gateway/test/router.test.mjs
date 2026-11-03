import test from "node:test";
import assert from "node:assert/strict";
import gateway, { summarizeTasks } from "../src/index.js";

const env = {
  TELEGRAM_BOT_TOKEN: "TEST_BOT_TOKEN",
  TELEGRAM_WEBHOOK_SECRET: "TEST_VALID_WEBHOOK_SECRET_ABC123",
  TELEGRAM_CHAT_ID: "12345678",
};
function hook(message, token = env.TELEGRAM_WEBHOOK_SECRET) {
  return new Request("https://example.workers.dev/telegram-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": token,
    },
    body: JSON.stringify({ update_id: 1, message }),
  });
}
const message = (text, id = 12345678) => ({
  chat: { id, type: "private" },
  from: { id },
  text,
});

test("health endpoint returns ok without secrets", async () => {
  const res = await gateway.fetch(new Request("https://example.workers.dev/health"), {});
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "ok");
});

test("invalid webhook secret is rejected", async () => {
  const res = await gateway.fetch(hook(message("/ping"), "invalid"), env);
  assert.equal(res.status, 403);
});

test("unknown Telegram sender cannot trigger messages", async () => {
  const previous = globalThis.fetch;
  let sent = 0;
  globalThis.fetch = async () => { sent += 1; throw Error("Should not send"); };
  try {
    const res = await gateway.fetch(hook(message("/ping", 98765)), env);
    assert.equal(res.status, 200);
    assert.equal(sent, 0);
  } finally {
    globalThis.fetch = previous;
  }
});

test("authorized /ping sends an acknowledgement to the permitted chat", async () => {
  const previous = globalThis.fetch;
  let outbound;
  globalThis.fetch = async (url, options) => {
    outbound = { url, options };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  try {
    const res = await gateway.fetch(hook(message("/ping")), env);
    assert.equal(res.status, 200);
    assert.ok(outbound.url.endsWith("/sendMessage"));
    const payload = JSON.parse(outbound.options.body);
    assert.equal(payload.chat_id, env.TELEGRAM_CHAT_ID);
    assert.match(payload.text, /명령 수신 정상/);
  } finally {
    globalThis.fetch = previous;
  }
});

test("status falls back to the public badge if GitHub API is rate limited", async () => {
  const previous = globalThis.fetch;
  let payload;
  globalThis.fetch = async (url, options) => {
    if (url.includes("api.github.com")) return new Response("", {status:403});
    if (url.includes("/badge.svg")) return new Response("<svg><title>GeoTeacher Telegram Notifications - passing</title></svg>");
    payload = JSON.parse(options.body);
    return new Response("{}", {status:200});
  };
  try {
    assert.equal((await gateway.fetch(hook(message("/status")), env)).status, 200);
    assert.match(payload.text, /공개 실행 배지\(main\): 성공/);
    assert.match(payload.text, /캐시/);
  } finally { globalThis.fetch = previous; }
});
test("status remains unknown when the API and badge are unavailable", async () => {
  const previous = globalThis.fetch;
  let payload;
  globalThis.fetch = async (url, options) => {
    if (!url.includes("api.telegram.org")) return new Response("", {status:503});
    payload = JSON.parse(options.body);
    return new Response("{}", {status:200});
  };
  try {
    assert.equal((await gateway.fetch(hook(message("/status")), env)).status, 200);
    assert.match(payload.text, /확인하지 못했습니다/);
  } finally { globalThis.fetch = previous; }
});

const task = (due, status="수집됨", checked=false, level="일반 업무") => ({
  properties: {
    "업무명": {title:[{plain_text:"PRIVATE_TITLE_NOT_FOR_TELEGRAM"}]},
    "정보 등급": {select:{name:level}},
    "진행 상태": {status:{name:status}},
    "교사 완료 확인": {checkbox:checked},
    "마감일시": {date:due ? {start:due} : null},
  },
});
test("Notion counts use KST and exclude completed, checked and internal records", () => {
  const counts=summarizeTasks([
    task("2026-11-03"), task("2026-11-02"), task("2026-11-10"),
    task("2026-11-11"), task(null), task("2026-11-03","완료"),
    task("2026-11-03","제외"), task("2026-11-03","진행 중",true),
    task("2026-11-03","진행 중",false,"내부 업무"),
    task("2026-11-02T16:00:00Z"),
  ], new Date("2026-11-02T16:30:00Z"));
  assert.deepEqual(counts,{open:6,today:2,overdue:1,next7:1});
});
test("today without a Notion token gives setup state without querying Notion", async () => {
  const previous=globalThis.fetch;
  let payload;
  globalThis.fetch=async (url,options)=>{
    assert.ok(url.includes("api.telegram.org"));
    payload=JSON.parse(options.body);
    return new Response("{}");
  };
  try {
    await gateway.fetch(hook(message("/today")),env);
    assert.match(payload.text,/설정 대기/);
    assert.doesNotMatch(payload.text,/미완료: 0건/);
  } finally { globalThis.fetch=previous; }
});
test("today requests only minimal properties and sends counts without titles", async () => {
  const previous=globalThis.fetch;
  let payload, queried=0;
  globalThis.fetch=async (url,options)=>{
    if(url.includes("api.notion.com")){
      queried++;
      const u=new URL(url);
      assert.deepEqual(u.searchParams.getAll("filter_properties"),["진행 상태","마감일시","교사 완료 확인","정보 등급"]);
      assert.equal(options.method,"POST");
      assert.ok(JSON.parse(options.body).filter.and.length===4);
      return Response.json({results:[task(null)],has_more:false,next_cursor:null});
    }
    payload=JSON.parse(options.body);
    return new Response("{}");
  };
  try {
    await gateway.fetch(hook(message("/today")),{...env,NOTION_API_TOKEN:"TEST_NOTION_TOKEN"});
    assert.equal(queried,1);
    assert.match(payload.text,/미완료: 1건/);
    assert.doesNotMatch(payload.text,/PRIVATE_TITLE|TEST_NOTION_TOKEN/);
  } finally { globalThis.fetch=previous; }
});
test("Notion errors never become zero counts or expose response bodies", async () => {
  const previous=globalThis.fetch;
  let payload;
  globalThis.fetch=async (url,options)=>{
    if(url.includes("api.notion.com")) return new Response("PRIVATE_ERROR_BODY",{status:403});
    payload=JSON.parse(options.body); return new Response("{}");
  };
  try {
    await gateway.fetch(hook(message("/today")),{...env,NOTION_API_TOKEN:"TEST_NOTION_TOKEN"});
    assert.match(payload.text,/읽기 권한/);
    assert.doesNotMatch(payload.text,/PRIVATE_ERROR_BODY|TEST_NOTION_TOKEN|미완료: 0건/);
  } finally { globalThis.fetch=previous; }
});
test("bounded pagination warns when counts are partial", async () => {
  const previous=globalThis.fetch;
  let n=0,payload;
  globalThis.fetch=async (url,options)=>{
    if(url.includes("api.notion.com")){
      n++;const body=JSON.parse(options.body);
      if(n>1)assert.equal(body.start_cursor,"cursor"+(n-1));
      return Response.json({results:[task(null)],has_more:true,next_cursor:"cursor"+n});
    }
    payload=JSON.parse(options.body);return new Response("{}");
  };
  try {
    await gateway.fetch(hook(message("/today")),{...env,NOTION_API_TOKEN:"TEST_NOTION_TOKEN"});
    assert.equal(n,3);assert.match(payload.text,/미완료: 3건/);assert.match(payload.text,/일부 항목만/);
  } finally { globalThis.fetch=previous; }
});
