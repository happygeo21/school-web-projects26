// Explicit, local-only backend double. Never included in the public manifest or Edge entry point.
import { quotaDecision, mediaError } from "../media-policy.js";
export function createMockMedia({
  capacity = 1_000_000_000,
  clock = () => Date.now(),
} = {}) {
  const rows = new Map(),
    objects = new Map(),
    works = new Map(),
    published = new Map();
  const state = {
    rows,
    objects,
    works,
    published,
    failPut: false,
    failReady: false,
    failDelete: false,
    failDB: false,
    bytes: 0,
    downloads: 0,
  };
  const path = (p) => `${p.schoolId}/${p.ownerUid}/${p.workId}`;
  const db = {
    work: async (p) => {
      if (state.failDB) throw Error("database unavailable");
      return works.get(path(p)) || null;
    },
    published: async (id) => {
      if (state.failDB) throw Error("database unavailable");
      return published.get(id) || null;
    },
  };
  const ledger = {
    reserve: async (d) => {
      const old = rows.get(d.asset_id);
      if (old && old.state !== "deleted") {
        if (old.sha256 !== d.sha256 || old.owner_uid !== d.owner_uid)
          throw Error("identity conflict");
        if (old.state === "ready") return { existing: true };
        throw mediaError("media/retry", "전송 중이에요.");
      }
      const used = [...rows.values()]
          .filter((r) => r.state !== "deleted")
          .reduce((s, r) => s + r.size, 0),
        q = quotaDecision(used, d.size, d.content_type, capacity);
      if (
        !old &&
        [...rows.values()].filter(
          (r) =>
            r.owner_uid === d.owner_uid &&
            clock() - Date.parse(r.created_at) < 86400000,
        ).length >= 3
      )
        throw mediaError("media/quota-full", "오늘의 제출 한도에 도달했어요.");
      const row = {
        ...d,
        state: "uploading",
        object_key: "private/" + d.asset_id + "/" + crypto.randomUUID(),
        created_at: new Date(clock()).toISOString(),
        updated_at: new Date(clock()).toISOString(),
      };
      rows.set(d.asset_id, row);
      return { object_key: row.object_key, warning: q.warning };
    },
    ready: async (id) => {
      if (state.failReady) {
        state.failReady = false;
        throw Error("lost ledger ACK");
      }
      rows.get(id).state = "ready";
    },
    deleted: async (id) => {
      const r = rows.get(id);
      r.state = "deleted";
      r.updated_at = new Date(clock()).toISOString();
    },
    missing: async (id) => {
      rows.get(id).state = "missing";
    },
    usage: async () => ({
      objectBytes: [...objects.values()].reduce(
        (n, o) => n + o.bytes.length,
        0,
      ),
      reservedBytes: [...rows.values()]
        .filter((r) => r.state === "uploading" || r.state === "missing")
        .reduce((n, r) => n + r.size, 0),
      capacity,
      estimatedTransferBytes: state.bytes,
      transferEstimate: true,
    }),
    find: async (id) => rows.get(id) || null,
    list: async () =>
      [...rows.values()].filter((r) => r.state !== "deleted").slice(0, 50),
    download: async (size) => {
      if (state.bytes + size > 4_000_000_000)
        throw mediaError("media/quota-full", "전송 한도를 넘었어요.");
      state.bytes += size;
      state.downloads++;
    },
  };
  const blobs = {
    put: async (key, bytes, type) => {
      if (state.failPut) throw Error("upload failed");
      objects.set(key, { bytes: new Uint8Array(bytes), type });
    },
    delete: async (key) => {
      if (state.failDelete) throw Error("delete unavailable");
      objects.delete(key);
    },
    read: async (key) => {
      const o = objects.get(key);
      if (!o) throw Error("missing");
      return new Response(o.bytes, {
        headers: {
          "Content-Type": o.type,
          "Content-Length": String(o.bytes.length),
        },
      });
    },
    head: async (key) => {
      const o = objects.get(key);
      return o ? { size: o.bytes.length, type: o.type } : null;
    },
  };
  return { state, db, ledger, blobs };
}
