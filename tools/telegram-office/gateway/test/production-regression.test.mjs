import test from "node:test";
import assert from "node:assert/strict";
import gateway from "../src/index.js";

test("legacy commands stay available with add disabled and never create Notion pages", async () => {
  const originalFetch = globalThis.fetch;
  const env = { TELEGRAM_BOT_TOKEN:"TEST_BOT", TELEGRAM_CHAT_ID:"12345678", TELEGRAM_WEBHOOK_SECRET:"TEST_SECRET", ADD_ENABLED:"false", NOTION_WRITE_TOKEN:"TEST_UNUSED_WRITER" };
  let replies = [];
  globalThis.fetch = async (url, options) => {
    url = String(url);
    if (url.startsWith("https://api.github.com/")) return Response.json({ workflow_runs:[{status:"completed",conclusion:"success"}] });
    assert.ok(url.endsWith("/sendMessage"), "Only Telegram replies and the existing GitHub status lookup are permitted");
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id, env.TELEGRAM_CHAT_ID);
    assert.equal(body.reply_markup, undefined);
    assert.doesNotMatch(body.text, /TEST_UNUSED_WRITER|TEST_SECRET|TEST_BOT/);
    replies.push(body.text);
    return Response.json({ok:true});
  };
  try {
    for (const [index, command] of ["/ping","/projects","/status","/today"].entries()) {
      const request = new Request("https://test.workers.dev/telegram-webhook", {
        method:"POST", headers:{"x-telegram-bot-api-secret-token":env.TELEGRAM_WEBHOOK_SECRET},
        body:JSON.stringify({update_id:index+1,message:{chat:{id:12345678,type:"private"},from:{id:12345678},text:command}}),
      });
      assert.equal((await gateway.fetch(request,env)).status,200);
    }
    assert.match(replies[0],/명령 수신 정상/);
    assert.match(replies[1],/https:\/\/github.com\/happygeo21\/school-web-projects26/);
    assert.match(replies[2],/최근 알림 워크플로 결과: 성공/);
    assert.match(replies[3],/읽기 전용 연결 설정 대기/);
  } finally { globalThis.fetch = originalFetch; }
});
