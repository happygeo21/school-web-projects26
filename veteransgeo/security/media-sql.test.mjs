import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("local Postgres WASM: SQL compiles, RLS denies public, reservations enforce MIME/byte/day limits and download budget", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role; create schema storage; create table storage.buckets(id text primary key,name text,public bool,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(metadata jsonb);",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610290001_private_media.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const data = (i, type = "image/jpeg", size = 100) => ({
        asset_id: "p_" + String(i).padStart(64, "0"),
        school_id: "S1",
        owner_uid: "synthetic",
        work_id: "w" + i,
        size,
        content_type: type,
        sha256: "a".repeat(64),
      }),
      reserve = (p) =>
        db.query("select public.veterans_reserve_media($1::jsonb) as result", [
          JSON.stringify(p),
        ]);
    const first = (await reserve(data(1))).rows[0].result;
    assert.equal(first.existing, false);
    await db.query("select public.veterans_media_state($1,'ready')", [
      data(1).asset_id,
    ]);
    assert.equal((await reserve(data(1))).rows[0].result.existing, true);
    await reserve(data(2));
    await reserve(data(3));
    await assert.rejects(reserve(data(4)), /daily_limit/);
    await assert.rejects(
      reserve(data(5, "image/jpeg", 3145729)),
      /invalid_file/,
    );
    await assert.rejects(reserve(data(5, "text/html", 5)), /invalid_file/);
    await db.exec(
      "insert into storage.objects values ('{\"size\":899999900}');",
    );
    await assert.rejects(
      reserve({ ...data(8, "video/mp4", 200), owner_uid: "new" }),
      /quota_full/,
    );
    await db.query("select public.veterans_download_budget(3999999999)");
    await assert.rejects(
      db.query("select public.veterans_download_budget(2)"),
      /quota_egress/,
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from public.veterans_media"),
      /permission denied/,
    );
    await assert.rejects(reserve(data(9)), /permission denied/);
    await db.exec("reset role");
    const bucket = await db.query("select public from storage.buckets");
    assert.equal(bucket.rows[0].public, false);
  } finally {
    await db.close();
  }
});
