const {test}=require('node:test');const assert=require('node:assert/strict');
const {properties}=require('./notion-payload.cjs');
test('maps the existing Notion schema and chunks rich text without losing content',()=>{
  const body='가'.repeat(4000),p=properties({title:'<script>alert(1)</script>',body,category:'신혼집',status:'진행 중',date:'2027-02-25'});
  assert.equal(p['분야'].select.name,'화정동 주택');assert.equal(p['상태'].status.name,'문의 중');
  assert.equal(p['확인한 내용'].rich_text.map(x=>x.text.content).join(''),body);
  assert.ok(p['확인한 내용'].rich_text.every(x=>x.text.content.length<=2000));
  assert.equal(p['기록 제목'].title[0].text.content,'<script>alert(1)</script>');
});
test('rejects unknown completion states rather than silently marking them confirmed',()=>{
  assert.throws(()=>properties({status:'maybe'}));
});
