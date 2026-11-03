// Only this module uses the separately scoped writer. Never log input/errors.
export const TASK_SOURCE = "16c3caf5-6bc2-4758-aeae-7b9ba855b2a7";
export const INBOX_URL = "https://www.notion.so/f31cbd52f6e54805a7addc4abe7cb970";
const FORMAT = "입력 형식: /add 통합사회 활동지 준비 | 내일\n기한: 오늘, 내일, 모레 또는 YYYY-MM-DD (Asia/Seoul)";
const UNKNOWN = "저장 결과 확인이 필요합니다. 중복 방지를 위해 다시 생성하지 않습니다. 같은 승인 버튼으로 재조회하거나 Notion 업무함에서 확인하세요. 새 /add로 재등록하지 마세요.";
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function parseAdd(input, now = new Date()) {
  const parts = input.replace(/^(?:\/add(?:@[A-Za-z0-9_]+)?|업무등록)(?:\s+|$)/i, "").split("|");
  if (parts.length !== 2) throw new Error(FORMAT);
  const title = parts[0].trim().normalize("NFKC");
  const raw = parts[1].trim();
  if (title.length < 2 || title.length > 160 || /[\p{Cc}\p{Cf}]/u.test(title)) throw new Error("업무명은 줄바꿈 없이 2~160자로 입력하세요.\n" + FORMAT);
  // Conservative rejection; these checks cannot classify every possible name.
  if (/(?:학번|성적|출결|연락처|상담|주민번호|전화번호|학생\s*(?:이름|명단|개별)|[가-힣]{2,4}\s*학생|\d|@|https?:|ntn_|secret_|토큰|비밀키)/i.test(title)
      || /(?:^|\s)[김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허유남심노하곽성차주우구민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용][가-힣]{1,2}(?=\s|$)/u.test(title.replace(/(?:^|\s)(안내문|연구|교육|지도|자료|정리|개선|관리|설문|공유|공문|원고|조사|양식)(?=\s|$)/g, " "))) throw new Error("학생 이름·학번·성적·출결·연락처·상담 내용과 인증키는 입력할 수 없습니다. 개인정보 없는 일반 업무명만 사용하세요.");
  const today = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  let due;
  const offsets = { "오늘": 0, "내일": 1, "모레": 2 };
  if (Object.hasOwn(offsets, raw)) due = new Date(Date.parse(today + "T00:00:00Z") + offsets[raw] * 86400000).toISOString().slice(0, 10);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(raw + "T00:00:00Z");
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw) due = raw;
  }
  if (!due || due < today || due > "2099-12-31") throw new Error("기한을 확인하세요. 지난 날짜나 불명확한 날짜는 등록하지 않습니다.\n" + FORMAT);
  return { title, due };
}
async function notion(env, path, body) {
  const res = await fetch("https://api.notion.com/v1/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: "Bearer " + env.NOTION_WRITE_TOKEN, "Notion-Version": "2026-03-11", "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Notion request failed");
  return await res.json();
}
export function validateSchema(data) {
  if (data.id?.replaceAll("-", "") !== TASK_SOURCE.replaceAll("-", "")) throw new Error("Wrong data source");
  const schema = data.properties || {};
  const expected = { "업무명": "title", "정보 등급": "select", "진행 상태": "status", "마감일시": "date", "교사 완료 확인": "checkbox", "원본 식별키": "rich_text" };
  const result = {};
  for (const [name, type] of Object.entries(expected)) {
    const property = schema[name];
    if (property?.type !== type || typeof property.id !== "string" || !property.id) throw new Error("Schema mismatch");
    result[name] = { id: property.id, type };
  }
  for (const [name, option] of [["정보 등급", "일반 업무"], ["진행 상태", "수집됨"]]) {
    const p = schema[name];
    const found = p[p.type]?.options?.find(x => x.name === option);
    if (!found?.id) throw new Error("Option missing");
    result[name].option = found.id;
  }
  return result;
}
const readSchema = async env => validateSchema(await notion(env, "data_sources/" + TASK_SOURCE));
const rich = content => [{ type: "text", text: { content } }];
function properties(row, schema) {
  return {
    [schema["업무명"].id]: { title: rich(row.title) },
    [schema["정보 등급"].id]: { select: { id: schema["정보 등급"].option } },
    [schema["진행 상태"].id]: { status: { id: schema["진행 상태"].option } },
    [schema["마감일시"].id]: { date: { start: row.due } },
    [schema["교사 완료 확인"].id]: { checkbox: false },
    [schema["원본 식별키"].id]: { rich_text: rich("telegram:" + row.id) },
  };
}
const plain = items => (items || []).map(x => x.plain_text ?? x.text?.content ?? "").join("");
export function verifyPage(page, row) {
  const p = page.properties || {};
  const id = page.id;
  if (!UUID.test(id || "") || page.archived || page.in_trash
      || page.parent?.data_source_id?.replaceAll("-", "") !== TASK_SOURCE.replaceAll("-", "")
      || plain(p["업무명"]?.title) !== row.title || plain(p["원본 식별키"]?.rich_text) !== "telegram:" + row.id
      || p["마감일시"]?.date?.start !== row.due || p["마감일시"]?.date?.end
      || p["정보 등급"]?.select?.name !== "일반 업무" || p["진행 상태"]?.status?.name !== "수집됨"
      || p["교사 완료 확인"]?.checkbox !== false) throw new Error("Page verification failed");
  const url = new URL(page.url);
  if (url.protocol !== "https:" || !["www.notion.so", "notion.so", "app.notion.com"].includes(url.hostname)
      || !url.pathname.replaceAll("-", "").endsWith(id.replaceAll("-", ""))) throw new Error("Link verification failed");
  return { id, url: page.url };
}
const configured = env => env.ADD_ENABLED === "true" && env.TASK_DB && env.NOTION_WRITE_TOKEN && env.NOTION_WRITE_TOKEN !== env.NOTION_API_TOKEN;
function preview(row) {
  return {
    text: "📋 등록 전 확인\n\n업무명: " + row.title + "\n기한: " + row.due + " (한국시간, 날짜만 지정)"
      + "\n저장 위치: 03 · AI 업무함 | 교사 전용\n" + INBOX_URL
      + "\n일반 업무 · 수집됨 · 교사 완료 확인 안 함\n10분 안에 승인해야 저장됩니다. 개인정보가 없음을 확인한 뒤 승인하세요.",
    reply_markup: { inline_keyboard: [[{ text: "등록 승인", callback_data: "add:approve:" + row.id }, { text: "취소", callback_data: "add:cancel:" + row.id }]] },
  };
}
function stateReply(row) {
  if (row.state === "verified") return { text: "✅ Notion 저장 및 재조회 확인 완료\n업무 ID: " + row.page_id + "\n" + row.page_url };
  if (row.state === "cancelled") return { text: "취소했습니다. Notion에 저장하지 않았습니다." };
  if (row.state === "expired") return { text: "승인 유효기간이 지났습니다. Notion에 저장하지 않았습니다. /add로 다시 입력하세요." };
  return { text: UNKNOWN };
}
// Erase pending input on the next interaction after ten minutes. Minimal update
// tombstones remain so old Telegram deliveries never recreate a submission.
async function clean(db, now) {
  await db.prepare("UPDATE task_approvals SET state='expired', title=NULL, due=NULL, schema_json=NULL WHERE state='pending' AND expires_at<=?").bind(now).run();
  await db.prepare("UPDATE task_approvals SET title=NULL, due=NULL, schema_json=NULL WHERE state IN ('verified','cancelled')").run();
}
export async function prepareAdd(input, updateId, owner, env, now = new Date()) {
  let parsed;
  try { parsed = parseAdd(input, now); } catch (error) { return { text: error.message }; }
  if (!configured(env)) return { text: "업무 등록은 설정 대기 중입니다. 별도 Notion 쓰기 연결과 D1 설정을 확인하세요. 기존 /today는 계속 사용할 수 있습니다." };
  if (!Number.isSafeInteger(updateId) || updateId < 0) return { text: "등록 요청 번호를 확인하지 못했습니다. 저장하지 않았습니다." };
  try {
    env = { ...env, TASK_DB: env.TASK_DB.withSession("first-primary") };
    const time = now.getTime();
    await clean(env.TASK_DB, time);
    const existing = await env.TASK_DB.prepare("SELECT * FROM task_approvals WHERE update_id=?").bind(updateId).first();
    if (existing) return existing.state === "pending" ? preview(existing) : stateReply(existing);
    const schema = await readSchema(env); // GET only, no page writes before approval.
    const id = crypto.randomUUID().replaceAll("-", "");
    await env.TASK_DB.prepare("INSERT INTO task_approvals (id, update_id, owner, title, due, schema_json, expires_at, state) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending') ON CONFLICT(update_id) DO NOTHING")
      .bind(id, updateId, owner, parsed.title, parsed.due, JSON.stringify(schema), time + 600000).run();
    const row = await env.TASK_DB.prepare("SELECT * FROM task_approvals WHERE update_id=?").bind(updateId).first();
    return row.state === "pending" ? preview(row) : stateReply(row);
  } catch {
    return { text: "업무 등록 준비 실패: Notion 인증·업무함 스키마·D1 연결을 확인하세요. 저장하지 않았습니다." };
  }
}
async function reconcile(row, env) {
  // Never retry POST /pages, even after timeout/401/403/429 or Worker restart.
  let pageId = row.page_id;
  if (!pageId) {
    const data = await notion(env, "data_sources/" + TASK_SOURCE + "/query?filter_properties=" + encodeURIComponent("원본 식별키"), {
      page_size: 2, filter: { property: "원본 식별키", rich_text: { equals: "telegram:" + row.id } },
    });
    if (data.has_more !== false || data.results?.length !== 1) return { text: UNKNOWN };
    pageId = data.results[0].id;
    if (!UUID.test(pageId || "")) return { text: UNKNOWN };
    await env.TASK_DB.prepare("UPDATE task_approvals SET page_id=? WHERE id=? AND state='creating'").bind(pageId, row.id).run();
  }
  const verified = verifyPage(await notion(env, "pages/" + pageId), row);
  if (verified.id !== pageId) throw new Error("ID mismatch");
  await env.TASK_DB.prepare("UPDATE task_approvals SET state='verified', page_id=?, page_url=?, title=NULL, due=NULL, schema_json=NULL WHERE id=? AND state='creating'")
    .bind(verified.id, verified.url, row.id).run();
  return stateReply({ state: "verified", page_id: verified.id, page_url: verified.url });
}
export async function approveAdd(data, owner, env, now = new Date()) {
  if (!configured(env)) return { text: "업무 등록은 설정 대기 중입니다. 관리자에게 연결 설정을 확인하세요." };
  const match = /^add:(approve|cancel):([a-f0-9]{32})$/.exec(data || "");
  if (!match) return { text: "유효하지 않은 승인 버튼입니다." };
  try {
    env = { ...env, TASK_DB: env.TASK_DB.withSession("first-primary") };
    await clean(env.TASK_DB, now.getTime());
    const row = await env.TASK_DB.prepare("SELECT * FROM task_approvals WHERE id=? AND owner=?").bind(match[2], owner).first();
    if (!row) return { text: "승인 대기 항목을 찾을 수 없습니다." };
    if (["verified", "cancelled", "expired"].includes(row.state)) return stateReply(row);
    if (match[1] === "cancel") {
      const cancelled = await env.TASK_DB.prepare("UPDATE task_approvals SET state='cancelled', title=NULL, due=NULL, schema_json=NULL WHERE id=? AND owner=? AND state='pending' RETURNING id").bind(row.id, owner).first();
      return cancelled ? stateReply({ state: "cancelled" }) : { text: "이미 저장을 시작한 항목은 취소할 수 없습니다. 같은 승인 버튼으로 저장 결과를 확인하세요." };
    }
    if (row.state === "creating") return await reconcile(row, env);
    const schema = await readSchema(env);
    if (JSON.stringify(schema) !== row.schema_json) return { text: "확인 화면 이후 Notion 속성 구성이 바뀌었습니다. 저장하지 않았습니다. 취소 후 다시 입력하세요." };
    const claimed = await env.TASK_DB.prepare("UPDATE task_approvals SET state='creating' WHERE id=? AND owner=? AND state='pending' AND expires_at>? RETURNING id")
      .bind(row.id, owner, Date.now()).first();
    if (!claimed) return { text: "이미 처리 중이거나 승인 시간이 지났습니다. 같은 승인 버튼으로 결과를 확인하세요." };
    const created = await notion(env, "pages", { parent: { type: "data_source_id", data_source_id: TASK_SOURCE }, properties: properties(row, schema) });
    if (!UUID.test(created.id || "")) return { text: UNKNOWN };
    await env.TASK_DB.prepare("UPDATE task_approvals SET page_id=? WHERE id=? AND state='creating'").bind(created.id, row.id).run();
    return await reconcile({ ...row, state: "creating", page_id: created.id }, env);
  } catch {
    return { text: "Notion 인증·권한 또는 연결 확인이 필요합니다.\n" + UNKNOWN };
  }
}
