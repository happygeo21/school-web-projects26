// Local test database only. Real PostgreSQL functions; mocked Firebase identities and object bytes.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { mediaError } from "../media-policy.js";
import { createInvitePolicy } from "../server/invite-policy.mjs";
// Explicit synthetic assignments. No real teacher identifiers are stored in fixtures.
export const fixtureInvitePolicy = () => createInvitePolicy({ teachers: ["teacher"], schools: { teacher: ["S1","S2","S3","S4","S5","S6","S7"] } });
export async function inviteDatabase() {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public bool,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(metadata jsonb);");
  for (const name of ["202610290001_private_media.sql", "202610300001_upload_invites.sql"])
    await db.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
  const query = async (sql, params = []) => (await db.query(sql, params)).rows;
  const store = async (action, data, actor) => {
    try { return (await query("select public.veterans_upload_access($1,$2::jsonb,$3::jsonb) as r", [action, JSON.stringify(data), JSON.stringify(actor ?? null)]))[0].r; }
    catch (e) {
      if (/invite_scope_denied/.test(e.message)) throw mediaError("media/permission", "담당 학교의 본인 발급 링크만 관리할 수 있어요.");
      if (/invite_denied/.test(e.message)) throw mediaError("media/permission", "업로드 링크가 만료되었거나 학교·학생 연결이 달라요. 새 링크로 다시 연결해주세요. 글과 선택한 파일은 유지돼요.");
      if (/invite_quota/.test(e.message)) throw mediaError("media/quota-full", "수업 링크 제출 한도에 도달했어요. 글과 선택한 파일은 유지돼요.");
      if (/daily_limit|quota/.test(e.message)) throw mediaError("media/quota-full", "제출 한도에 도달했어요.");
      throw e;
    }
  };
  const ledger = {
    reserve: async p => (await query("select public.veterans_reserve_media($1::jsonb) as r", [JSON.stringify(p)]))[0].r,
    ready: id => query("select public.veterans_media_state($1,'ready')", [id]),
    deleted: id => query("select public.veterans_media_state($1,'deleted')", [id]),
    find: async id => (await query("select * from public.veterans_media where asset_id=$1", [id]))[0] || null,
    list: () => query("select * from public.veterans_media where state<>'deleted'"),
    download: bytes => query("select public.veterans_download_budget($1)", [bytes]),
    usage: async () => (await query("select public.veterans_storage_usage() as r"))[0].r,
  };
  return { db, store, ledger, query, close: () => db.close() };
}
