import test from "node:test";
import assert from "node:assert/strict";
import gateway from "../src/index.js";

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
