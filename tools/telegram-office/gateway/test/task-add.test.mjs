import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import gateway from "../src/index.js";
import { parseAdd, validateSchema, TASK_SOURCE } from "../src/task-add.js";

// Execute the actual migration and SQL, rather than imitating CAS with a Map.
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/0001_task_approvals.sql", import.meta.url), "utf8"));
  return {
    sqlite,
    withSession() { return this; },
    prepare(sql) {
      let args = [];
      return { bind(...values) { args = values; return this; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async run() { return sqlite.prepare(sql).run(...args); } };
    },
  };
}
function schema() {
  const properties = {};
  for (const [name, type] of Object.entries({"업무명":"title","정보 등급":"select","진행 상태":"status","마감일시":"date","교사 완료 확인":"checkbox","원본 식별키":"rich_text"})) {
    properties[name] = { id: name, type, [type]: {} };
  }
  properties["정보 등급"].select.options = [{id:"general",name:"일반 업무"}];
  properties["진행 상태"].status.options = [{id:"collected",name:"수집됨"}];
  return { id: TASK_SOURCE, properties };
}
const owner = "12345678";
const pageId = "12345678-1234-1234-1234-123456789abc";
const pageURL = "https://www.notion.so/" + pageId.replaceAll("-", "");
function hook(update, secret = "TEST_WEBHOOK") {
  return new Request("https://test.workers.dev/telegram-webhook", {method:"POST",headers:{"x-telegram-bot-api-secret-token":secret},body:JSON.stringify(update)});
}
const message = text => ({chat:{id:owner,type:"private"},from:{id:owner},text});
function setup() {
  const db = database();
  const env = {TELEGRAM_BOT_TOKEN:"TEST_BOT",TELEGRAM_CHAT_ID:owner,TELEGRAM_WEBHOOK_SECRET:"TEST_WEBHOOK",NOTION_API_TOKEN:"TEST_READER",NOTION_WRITE_TOKEN:"TEST_WRITER",ADD_ENABLED:"true",TASK_DB:db};
  const requests = [], replies = [];
  let created, createCount=0, options={};
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, init={}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({url,init,body});
    if (url.includes("api.telegram.org")) {
      if (url.endsWith("/sendMessage")) {
        if (options.deliveryFail) return new Response("", {status:502});
        replies.push(body);
      }
      return Response.json({ok:true});
    }
    assert.ok(url.startsWith("https://api.notion.com/v1/"));
    assert.equal(init.headers.Authorization,"Bearer TEST_WRITER");
    if (url.endsWith("/data_sources/"+TASK_SOURCE)) {
      if(options.schemaStatus) return new Response("PRIVATE_ERROR_BODY",{status:options.schemaStatus});
      return Response.json(options.schema || schema());
    }
    if (url.endsWith("/pages")) {
      createCount++;
      if(options.createStatus) return new Response("PRIVATE_ERROR_BODY",{status:options.createStatus});
      created = { id:pageId, url:pageURL, parent:{data_source_id:TASK_SOURCE}, properties: structuredClone(body.properties) };
      created.properties["정보 등급"].select.name = "일반 업무";
      created.properties["진행 상태"].status.name = "수집됨";
      if(options.createTimeout) throw new Error("PRIVATE_TIMEOUT_TEST_WRITER");
      return Response.json(created);
    }
    if (url.includes("/query?")) {
      assert.equal(body.filter.rich_text.equals.startsWith("telegram:"),true);
      assert.deepEqual(new URL(url).searchParams.getAll("filter_properties"),["원본 식별키"]);
      return Response.json({results:created ? [created] : [],has_more:false});
    }
    if (url.endsWith("/pages/"+pageId)) {
      if(options.readFail) return new Response("PRIVATE_ERROR_BODY",{status:503});
      return Response.json(options.corrupt ? {...created,parent:{data_source_id:"wrong"}} : created);
    }
    throw Error("Unexpected endpoint");
  };
  return {
    db, env, requests, replies,
    options(value) { options = value; },
    get writes() { return createCount; },
    get row() { return db.sqlite.prepare("SELECT * FROM task_approvals LIMIT 1").get(); },
    async add(id=100,text="/add 통합사회 활동지 준비 | 내일") {
      return gateway.fetch(hook({update_id:id,message:message(text)}),env);
    },
    callback(action="approve", overrides={}) {
      return {update_id:101,callback_query:{id:"callback-test",data:"add:"+action+":"+this.row.id,from:{id:owner},message:{chat:{id:owner,type:"private"}},...overrides}};
    },
    async click(action="approve") { return gateway.fetch(hook(this.callback(action)),env); },
    close() { globalThis.fetch=previous; db.sqlite.close(); },
  };
}

test("dates accept examples, exact dates and KST midnight; reject ambiguous/invalid/past dates and empty titles",()=>{
  const now=new Date("2026-11-02T15:00:00Z");
  assert.deepEqual(parseAdd("/add 통합사회 활동지 준비 | 내일",now),{title:"통합사회 활동지 준비",due:"2026-11-04"});
  assert.equal(parseAdd("업무등록 eGIS 학생 안내문 점검 | 2026-11-06",now).due,"2026-11-06");
  assert.equal(parseAdd("/add@GeoTeacherBot 활동지 준비 | 오늘",now).due,"2026-11-03");
  for(const input of ["/add | 내일","/add 활동지 준비 | 2026-02-30","/add 활동지 준비 | 다음 주","/add 활동지 준비 | 2026-11-02","/add 활동지 준비","/add 활동지 준비 | 2026-13-01","/add 활동지 준비 | 내일 | 모레"]) assert.throws(()=>parseAdd(input,now));
});
test("sensitive input is rejected without echo, persistence or external requests",async()=>{
  const c=setup();try{
    for(const text of ["김테스트 학생 상담","학생 이름 확인","학번 10000 정리","성적 점검","출결 확인","test@example.invalid 검토","010-0000-0000 확인","ntn_test 확인","김민수 확인","활동지\n준비"]){
      await c.add(100,"/add "+text+" | 내일");
      assert.equal(c.row,undefined); assert.equal(c.writes,0);
      assert.doesNotMatch(c.replies.at(-1).text,/김민수|0000|ntn_test|example.invalid/);
    }
    assert.ok(c.requests.every(x=>x.url.includes("telegram.org")));
  }finally{c.close();}
});
test("schema rejects wrong source, property types and absent actual choices",()=>{
  for(const change of [s=>s.id="wrong",s=>s.properties["마감일시"].type="rich_text",s=>s.properties["진행 상태"].status.options=[],s=>delete s.properties["원본 식별키"]]){
    const s=schema();change(s);assert.throws(()=>validateSchema(s));
  }
});
test("preview performs only schema GET; approval creates once and GET verifies ID, parent, properties and URL",async()=>{
  const c=setup();try{
    assert.equal((await c.add()).status,200);assert.equal(c.writes,0);assert.equal(c.row.state,"pending");
    assert.match(c.replies.at(-1).text,/저장 위치: 03/);
    const buttons=c.replies.at(-1).reply_markup.inline_keyboard[0];
    assert.deepEqual(buttons.map(b=>b.text),["등록 승인","취소"]);assert.ok(buttons.every(b=>b.callback_data.length<=64));
    assert.equal((await c.click()).status,200);assert.equal(c.writes,1);assert.equal(c.row.state,"verified");
    assert.equal(c.row.title,null);assert.equal(c.row.page_id,pageId);assert.match(c.replies.at(-1).text,/재조회 확인 완료/);assert.ok(c.replies.at(-1).text.includes(pageURL));
    const create=c.requests.find(x=>x.url.endsWith("/pages"));
    assert.equal(create.body.parent.data_source_id,TASK_SOURCE);assert.equal(create.body.properties["교사 완료 확인"].checkbox,false);
    assert.equal(create.body.properties["정보 등급"].select.id,"general");assert.equal(create.body.properties["진행 상태"].status.id,"collected");
    assert.ok(c.requests.some(x=>x.url.endsWith("/pages/"+pageId)));
    assert.equal(c.requests.some(x=>x.init.method==="PATCH" || x.init.method==="DELETE"),false);
  }finally{c.close();}
});
test("cancellation and expired approvals never write; re-delivered commands reuse durable tombstones",async()=>{
  for(const mode of ["cancel","expire"]){const c=setup();try{
    await c.add();const original=c.row.id;
    if(mode==="cancel")await c.click("cancel");
    else c.db.sqlite.prepare("UPDATE task_approvals SET expires_at=0").run();
    await c.click();await c.add();await c.click();
    assert.equal(c.writes,0);assert.equal(c.row.id,original);assert.equal(c.row.title,null);assert.equal(c.row.state,mode==="cancel"?"cancelled":"expired");
  }finally{c.close();}}
});
test("simultaneous repeated approvals, webhook redelivery and a new Worker instance issue only one create",async()=>{
  const c=setup();try{
    await Promise.all([c.add(),c.add(),c.add()]);assert.equal(c.db.sqlite.prepare("SELECT count(*) AS n FROM task_approvals").get().n,1);
    const update=c.callback();
    await Promise.all(Array.from({length:6},()=>gateway.fetch(hook(update),c.env)));
    // A new request/environment object still uses the same persisted D1 row.
    await gateway.fetch(hook({...update,update_id:999}),{...c.env});await c.add();
    assert.equal(c.writes,1);assert.equal(c.row.state,"verified");
  }finally{c.close();}
});
test("owner chat, sender, group and webhook authentication block all effects",async()=>{
  const c=setup();try{
    await c.add();const count=c.requests.length;
    for(const update of [c.callback("approve",{from:{id:"999"}}),c.callback("approve",{message:{chat:{id:"999",type:"private"}}}),c.callback("approve",{message:{chat:{id:owner,type:"group"}}})])assert.equal((await gateway.fetch(hook(update),c.env)).status,200);
    assert.equal((await gateway.fetch(hook(c.callback(),"wrong"),c.env)).status,403);
    assert.equal(c.requests.length,count);assert.equal(c.writes,0);
  }finally{c.close();}
});
test("schema auth/permission failures and schema drift do not create or expose secrets",async()=>{
  const c=setup();try{
    for(const status of [401,403,404]){c.options({schemaStatus:status});await c.add();assert.equal(c.row,undefined);}
    c.options({});await c.add();const changed=schema();changed.properties["업무명"].id="changed";c.options({schema:changed});
    await c.click();assert.equal(c.writes,0);assert.equal(c.row.state,"pending");assert.match(c.replies.at(-1).text,/구성이 바뀌/);
    assert.doesNotMatch(JSON.stringify(c.replies),/TEST_WRITER|TEST_READER|PRIVATE_ERROR_BODY/);
  }finally{c.close();}
});
test("create authentication/access failures stay locked; retries never send another POST pages",async()=>{
  for(const status of [401,403,404,429,500]){const c=setup();try{
    await c.add();c.options({createStatus:status});await c.click();await c.click();await c.add();
    assert.equal(c.writes,1);assert.equal(c.row.state,"creating");assert.match(c.replies.at(-1).text,/確認|확인/);
    assert.doesNotMatch(JSON.stringify(c.replies),/TEST_WRITER|PRIVATE_ERROR_BODY/);
  }finally{c.close();}}
});
test("lost create response recovers by exact original key without duplicate creation",async()=>{
  const c=setup();try{
    await c.add();c.options({createTimeout:true});await c.click();assert.equal(c.row.state,"creating");
    c.options({});await c.click();assert.equal(c.writes,1);assert.equal(c.row.state,"verified");assert.ok(c.requests.some(x=>x.url.includes("/query?")));
  }finally{c.close();}
});
test("readback failures and wrong parent cannot claim success; persisted page ID enables retry",async()=>{
  for(const option of [{readFail:true},{corrupt:true}]){const c=setup();try{
    await c.add();c.options(option);await c.click();assert.equal(c.row.state,"creating");assert.equal(c.row.page_id,pageId);assert.doesNotMatch(c.replies.at(-1).text,/확인 완료/);
    c.options({});await c.click();assert.equal(c.row.state,"verified");assert.equal(c.writes,1);
  }finally{c.close();}}
});
test("a crash after the durable claim, before POST, fails closed forever",async()=>{
  const c=setup();try{
    await c.add();c.db.sqlite.prepare("UPDATE task_approvals SET state='creating'").run();
    await c.click();await c.click();assert.equal(c.writes,0);assert.equal(c.row.state,"creating");assert.match(c.replies.at(-1).text,/다시 생성하지/);
  }finally{c.close();}
});
test("failed Telegram delivery after verified save can be redelivered without another create",async()=>{
  const c=setup();try{
    await c.add();c.options({deliveryFail:true});assert.equal((await c.click()).status,502);assert.equal(c.row.state,"verified");
    c.options({});await c.click();assert.equal(c.writes,1);assert.match(c.replies.at(-1).text,/확인 완료/);
  }finally{c.close();}
});
test("disabled add, missing writer or reused reader keep existing basic commands usable",async()=>{
  const c=setup();try{
    for(const edit of [{ADD_ENABLED:"false"},{NOTION_WRITE_TOKEN:""},{NOTION_WRITE_TOKEN:"TEST_READER"},{TASK_DB:null}]){
      const env={...c.env,...edit};await gateway.fetch(hook({update_id:200,message:message("/add 활동지 준비 | 내일")}),env);
      assert.match(c.replies.at(-1).text,/설정 대기/);assert.equal(c.writes,0);
      await gateway.fetch(hook({update_id:201,message:message("/ping")}),env);assert.match(c.replies.at(-1).text,/수신 정상/);
    }
  }finally{c.close();}
});
