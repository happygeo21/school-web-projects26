-- Private D1 only. Do not export production rows into a public repository.
CREATE TABLE task_approvals (
  id TEXT PRIMARY KEY,
  update_id INTEGER NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  title TEXT,
  due TEXT,
  schema_json TEXT,
  expires_at INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','creating','verified','cancelled','expired')),
  page_id TEXT,
  page_url TEXT
);
CREATE INDEX task_approvals_expiry ON task_approvals(state, expires_at);
