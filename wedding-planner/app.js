import {cloudConfig, notionEnabled, notionEndpoint} from './cloud-config.js';
import {createAttachments} from './attachments.js?v=20261022-files3';
const $ = id => document.getElementById(id);
let api, auth, db, allowed = false, records = [], stopRecords, stopMember;
let editing = null, generation = 0, saving = false, exporting = false;
const localDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const message = (text, error = false) => { $('notice').textContent=text; $('notice').classList.toggle('error',error); };
const attachments=createAttachments({endpoint:notionEndpoint,session:()=>({allowed,user:auth?.currentUser,generation}),message});
const categoryLabels={'호텔':'가족 식사·호텔','가족 일정':'가족 일정','촬영':'웨딩스냅','신혼집':'신혼집 구매','예산':'공통 예산','혼인신고':'혼인신고','기타':'기타'};
const areas={'식사':['호텔','가족 일정'],'스냅':['촬영'],'집':['신혼집']};
const inArea=(r,area)=>area==='전체'||(areas[area]?areas[area].includes(r.category):r.category===area);
const examples={
  '호텔':['예: 가족 식사 견적을 받았어요','룸·메뉴·이용 시간·취소 조건 등 확인한 사실을 적어요.'],
  '촬영':['예: 봄 웨딩스냅 후보를 비교했어요','촬영 방식·장소·구성·우천 대안·보정 범위를 적어요.'],
  '신혼집':['예: 신혼집 후보를 방문했어요','후보 별칭·장단점·확인한 조건을 적어요. 정확한 주소·계약서는 별도 보관해요.']
};
function updateExamples(){const example=examples[$('category').value]||['예: 함께 결정한 내용을 남겨요','확인한 사실과 아직 정하지 않은 부분을 나눠 적어 주세요.'];$('title').placeholder=example[0];$('body').placeholder=example[1];}
function tab(name) {
  document.querySelectorAll('.view').forEach(el => el.hidden=el.id!==name);
  document.querySelectorAll('[data-tab]').forEach(el => el.setAttribute('aria-selected',String(el.dataset.tab===name)));
}
document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>tab(el.dataset.tab));
document.querySelectorAll('[data-template]').forEach(el=>el.onclick=()=>{
  if(saving||attachments.isBusy())return message('파일 처리가 끝난 뒤 새 기록을 시작해 주세요.');
  if((editing||$('title').value||$('body').value||$('nextAction').value||attachments.hasPending())&&!confirm('작성 중인 내용과 선택한 파일을 비우고 새 기록을 시작할까요?'))return;
  resetForm();tab('journal');$('category').value=el.dataset.template;
  $('filter').value=Object.keys(areas).find(area=>areas[area].includes(el.dataset.template))||'전체';
  updateExamples();render();$('title').focus();
});
document.querySelectorAll('[data-area]').forEach(el=>el.onclick=()=>{
  tab('journal');$('filter').value=el.dataset.area;
  if(!editing&&!$('title').value&&!$('body').value&&!$('nextAction').value){$('category').value={'식사':'호텔','스냅':'촬영','집':'신혼집'}[el.dataset.area];updateExamples();}
  render();$('filter').focus();
});
$('category').onchange=updateExamples;
function resetForm() { attachments.clearPending();editing=null; $('recordForm').reset(); $('date').value=localDate();$('formTitle').textContent='새 기록 남기기';$('cancelEdit').hidden=true;updateExamples(); }
function clearPrivate() {
  $('guideTool').removeAttribute('src');$('toolPanel').hidden=true;
  stopRecords?.();stopRecords=null;records=[];allowed=false;resetForm();render();
  attachments.clearPrivate();
  $('save').disabled=true;$('backup').disabled=true;$('loginPanel').hidden=false;
}
function button(text,fn) { const el=document.createElement('button');el.type='button';el.textContent=text;el.onclick=fn;return el; }
function card(r) {
  const el=document.createElement('article');el.className='record';
  const meta=document.createElement('div');meta.className='meta';meta.textContent=`${r.date} · ${categoryLabels[r.category]||r.category} · ${r.status}`;
  const title=document.createElement('h3');title.textContent=r.title;
  const body=document.createElement('p');body.textContent=r.body;
  el.append(meta,title,body);
  if(r.amount||(r.amountKind&&r.amountKind!=='미분류')){const amount=document.createElement('p');amount.className='money';amount.textContent=`${r.amountKind||'미분류'} · ${r.amount.toLocaleString('ko-KR')}원`;el.append(amount);}
  if(r.nextAction){const next=document.createElement('p');next.className='next-action';next.textContent=`다음 행동 · ${r.nextAction}`;el.append(next);}
  if(r.dueDate){const due=document.createElement('p');due.className='due';due.textContent=`예정일 · ${r.dueDate}${r.status!=='완료'&&r.dueDate<localDate()?' · 일정 다시 확인':''}`;el.append(due);}
  const actions=document.createElement('div');actions.className='actions';
  actions.append(button('수정하기',()=>{
    if(!allowed||saving||attachments.isBusy())return;
    if((editing||$('title').value||$('body').value||attachments.hasPending())&&!confirm('현재 입력과 선택 파일을 비우고 이 기록을 수정할까요?'))return;
    attachments.clearPending();editing={id:r.id,revision:r.revision};
    for(const key of ['title','body','category','status','date','amount'])$(key).value=r[key];
    $('amountKind').value=r.amountKind||'미분류';$('nextAction').value=r.nextAction||'';$('dueDate').value=r.dueDate||'';updateExamples();
    $('formTitle').textContent='기록 수정하기';$('cancelEdit').hidden=false;tab('journal');$('title').focus();
    attachments.showExisting(r);
  }));
  if(notionEnabled)actions.append(button('노션에 보내기',async()=>{
    if(!allowed||exporting||!auth.currentUser||!confirm('이 기록의 제목·내용·날짜·분야·상태와 관련 금액·금액 구분·다음 행동·예정일을 Cloudflare 전송 서버를 거쳐 노션 공동 기록 DB로 보낼까요?'))return;
    const epoch=generation;
    exporting=true;message('노션으로 보내는 중… 완료 표시를 기다려 주세요.');
    try{
      const token=await auth.currentUser.getIdToken();
      const response=await fetch(notionEndpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({id:r.id,revision:r.revision}),signal:AbortSignal.timeout(30000)});
      const result=await response.json();
      const errors={
        'daily-limit':'오늘의 노션 전송 한도(두 사람 합계 200회)에 도달했어요. 공동 저장은 계속 사용할 수 있고, 한국 시간 오전 9시 이후 다시 보낼 수 있어요.',
        'slow-down':'잠시 쉬었다가 6초 후 다시 보내 주세요.',
        'quota-exceeded':'무료 사용 한도로 전송을 멈췄어요. 공동 저장 여부를 확인하고, 한도가 초기화된 뒤 다시 시도해 주세요.',
        'record-changed':'다른 화면에서 기록이 수정됐어요. 최신 기록을 확인한 뒤 다시 보내 주세요.',
        'check-notion':'전송 결과를 확정할 수 없어 중복 전송을 막았어요. 노션을 먼저 확인하고 관리자에게 연결 복구를 요청해 주세요.',
        'access-denied':'전송 권한을 확인하지 못했어요. 허용된 Google 계정으로 다시 로그인해 주세요.',
        'notion-rejected':'노션이 전송을 거절했어요. 노션 연결 권한과 서버 설정을 확인해 주세요.'
      };
      if(!response.ok)throw Error(errors[result.code]||'노션 전송 서버에 연결하지 못했어요. 무료 한도 또는 연결 상태를 확인해 주세요.');
      if(epoch===generation)message(result.code==='already-sent'?'이 버전은 이미 노션에 반영했어요. 중복 기록은 만들지 않았습니다.':'노션 반영 완료 · 노션에서 직접 한 수정은 이 화면에 돌아오지 않습니다.');
    }catch(error){if(epoch===generation)message(error.name==='TimeoutError'||error.name==='TypeError'?'노션 반영을 확인하지 못했어요. 다시 누르기 전에 노션 기록을 먼저 확인해 주세요.':error.message,true);}
    finally{exporting=false;}
  }));
  el.append(actions);attachments.addCard(r,el);return el;
}
function render() {
  const selected=records.filter(r=>inArea(r,$('filter').value));
  for(const [area,categories] of Object.entries(areas)){
    const items=records.filter(r=>categories.includes(r.category));
    const count=document.querySelector(`[data-count="${area}"]`);
    if(count)count.textContent=allowed?`${items.length}건 · 남은 일 ${items.filter(r=>r.status!=='완료').length}개`:'로그인 후 기록 확인';
  }
  $('records').replaceChildren(...selected.map(card));
  if(!selected.length){const p=document.createElement('p');p.className='empty';p.textContent=allowed?'아직 기록이 없어요. 첫 소식을 남겨 주세요.':'로그인 후 공동 기록을 확인할 수 있어요.';$('records').append(p);}
  const todos=records.filter(r=>r.status!=='완료');$('todoList').replaceChildren(...todos.map(card));
  if(!todos.length){const p=document.createElement('p');p.className='empty';p.textContent=allowed?'남은 할 일이 없어요. 새 계획을 함께 남겨 보세요.':'로그인하면 우리 할 일이 여기에 모여요.';$('todoList').append(p);}
  const done=records.length-todos.length;$('counts').textContent=allowed?`${done} / ${records.length} 완료`:'로그인 후 표시';
  $('progress').style.width=(records.length?done/records.length*100:0)+'%';
}
$('filter').onchange=render;$('cancelEdit').onclick=()=>{if(saving||attachments.isBusy())return;if(attachments.hasPending()&&!confirm('선택한 첨부파일을 비우고 수정을 취소할까요?'))return;resetForm();};
$('recordForm').onsubmit=async e=>{
  e.preventDefault();if(!allowed||saving||attachments.isBusy()||!auth.currentUser)return;
  if(attachments.hasPending()&&!confirm('이 기록과 선택한 파일을 비공개 노션 Wedding Journal에도 보관할까요? 사진은 크기와 위치정보를 정리한 사본이며 문서는 원본입니다. 민감한 정보가 없는지 확인해 주세요.'))return;
  if(!navigator.onLine){message('오프라인입니다. 인터넷 연결 후 저장해 주세요. 입력 내용은 아직 공동 저장되지 않았습니다.',true);return;}
  const epoch=generation,uid=auth.currentUser.uid,target=editing?{...editing}:null;
  const values={};for(const key of ['title','body','category','status','date','amountKind','nextAction','dueDate'])values[key]=$(key).value.trim();
  values.amount=Number($('amount').value||0);
  if(!values.title||!Number.isFinite(values.amount)||values.amount<0||values.amount>1e9)return;
  saving=true;attachments.setBusy(true);let recordSaved=false;$('save').disabled=true;message('공동 저장 중… 이 화면을 닫지 마세요.');
  try {
    const ref=target?api.doc(db,'records',target.id):api.doc(api.collection(db,'records'));
    await api.runTransaction(db,async tx=>{
      if(epoch!==generation||!allowed)throw Error('권한이 변경되었습니다.');
      const snap=await tx.get(ref);
      if(target&&(!snap.exists()||snap.data().revision!==target.revision))throw Error('다른 사람이 이 기록을 수정했어요. 수정 취소 후 최신 기록을 열어 다시 반영해 주세요.');
      tx.set(ref,{...values,revision:target?target.revision+1:1,updatedBy:uid,updatedAt:api.serverTimestamp()});
    });
    recordSaved=true;
    if(epoch!==generation)return;
    const saved={id:ref.id,revision:target?target.revision+1:1};
    editing=saved;$('formTitle').textContent='기록 수정하기';$('cancelEdit').hidden=false;
    const withFiles=attachments.hasPending();await attachments.uploadPending(saved);
    if(epoch===generation){resetForm();message(withFiles?'기록과 파일 저장 완료 · 파일은 비공개 노션에 보관했어요. 기록의 사진·첨부파일 보기에서 확인하세요.':'공동 저장 완료 · 두 사람이 같은 기록을 볼 수 있어요.');}
  }catch(err){if(epoch===generation)message(recordSaved?'기록은 공동 저장됐지만 첨부가 완료되지 않았어요. '+err.message+' 선택한 파일을 유지했으니 확인 후 다시 저장해 주세요.':err.code==='resource-exhausted'?'무료 저장 한도에 도달해 저장하지 못했어요. 입력 내용을 복사해 보관하고 한도가 초기화된 뒤 다시 저장해 주세요.':err.message?.startsWith('다른 사람이')?err.message:'저장하지 못했습니다. 입력 내용을 유지했으니 연결과 권한을 확인한 뒤 다시 저장해 주세요.',true);}
  finally{saving=false;attachments.setBusy(false);$('save').disabled=!allowed;}
};
$('backup').onclick=()=>{
  if(!allowed||!confirm('개인 기록을 이 기기에 파일로 내려받습니다. 공용 기기에서는 저장하지 마세요.'))return;
  const blob=new Blob([JSON.stringify({format:'wedding-records-v2',exportedAt:new Date().toISOString(),records:records.map(({updatedBy,...r})=>r)},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`wedding-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('offline',()=>message('인터넷 연결이 끊겼어요. 화면의 기록은 마지막으로 불러온 내용입니다. 새 입력은 아직 저장되지 않았습니다.',true));
window.addEventListener('online',()=>message('인터넷에 다시 연결되었습니다. 공동 저장 완료 여부를 확인해 주세요.'));
window.addEventListener('beforeunload',e=>{if(saving||attachments.hasPending()||attachments.isBusy()||$('title').value||$('body').value||$('guideTool').hasAttribute('src')){e.preventDefault();e.returnValue='';}});
resetForm();render();
if(notionEnabled&&notionEndpoint)$('notionStatus').textContent='저장 후 ‘노션에 보내기’를 누르면 관련 금액·금액 구분·다음 행동·예정일까지 반영해요. 예전에 보낸 기록도 다시 누르면 금액이 추가돼요. 노션의 수정은 자동으로 돌아오지 않아요.';
async function boot(){
  if(!cloudConfig){$('connection').textContent='공동 저장 설정 중';message('공동 저장은 아직 준비 중이에요. 지금은 준비 가이드와 기존 계산기를 이용해 주세요.');return;}
  try {
    const base='https://www.gstatic.com/firebasejs/12.4.0/';
    const [app,a,f]=await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js'].map(x=>import(base+x)));
    api={...a,...f};const instance=app.initializeApp(cloudConfig);auth=a.getAuth(instance);
    db=f.initializeFirestore(instance,{localCache:f.memoryLocalCache()});
    await a.setPersistence(auth,a.inMemoryPersistence);
    $('login').disabled=false;$('connection').textContent='로그인 전';
    $('login').onclick=async()=>{
      $('login').disabled=true;message('Google 로그인 창을 여는 중이에요. 창에서 계정을 선택해 주세요.');
      try{await a.signInWithPopup(auth,new a.GoogleAuthProvider());}
      catch(error){message(error.code==='auth/unauthorized-domain'?'이 주소는 아직 로그인 허용 도메인이 아닙니다. 설정을 확인해 주세요.':'로그인이 완료되지 않았습니다. 팝업 허용과 로그인 계정을 확인해 주세요.',true);}
      finally{$('login').disabled=false;}
    };
    $('signout').onclick=async()=>{generation++;stopMember?.();stopMember=null;clearPrivate();await a.signOut(auth);message('로그아웃했습니다. 화면의 개인 기록을 비웠어요.');};
    a.onAuthStateChanged(auth,user=>{
      const epoch=++generation;stopMember?.();stopMember=null;clearPrivate();$('signout').hidden=!user;
      if(!user){$('connection').textContent='로그인 전';return;}
      $('connection').textContent='권한 확인 중';
      stopMember=f.onSnapshot(f.doc(db,'access','config'),member=>{
        if(epoch!==generation)return;
        if(!member.exists()||!user.emailVerified){clearPrivate();$('connection').textContent='접근 권한 필요';message('이 계정에는 공동 기록 접근 권한이 없습니다. 허용된 두 사람의 계정으로 로그인해 주세요.',true);return;}
        if(allowed)return;allowed=true;attachments.refresh();$('loginPanel').hidden=true;$('save').disabled=false;$('backup').disabled=false;$('connection').textContent='둘만의 공동 공간';
        stopRecords=f.onSnapshot(f.query(f.collection(db,'records'),f.orderBy('updatedAt','desc'),f.limit(500)),{includeMetadataChanges:true},snapshot=>{
          if(epoch!==generation)return;records=snapshot.docs.map(d=>({id:d.id,...d.data()}));render();
          if(!saving)message(snapshot.metadata.fromCache?'연결 확인 중 · 마지막으로 불러온 기록입니다.':'최신 공동 기록을 불러왔어요. (최근 500건)');
        },error=>{
          if(error.code==='resource-exhausted'){
            stopRecords?.();stopRecords=null;$('save').disabled=true;$('connection').textContent='무료 한도 도달';
            message('무료 읽기 한도에 도달해 공동 저장을 잠시 멈췄어요. 화면은 마지막으로 불러온 기록입니다. 작성 중인 내용은 복사해 보관하고 한도 초기화 후 새로고침해 주세요.',true);
          }else{clearPrivate();message('공동 기록을 불러올 수 없습니다. 접근 권한과 연결 상태를 확인해 주세요.',true);}
        });
      },()=>{clearPrivate();$('connection').textContent='접근 권한 필요';message('이 계정의 접근 권한을 확인하지 못했습니다. 허용된 두 사람의 Google 계정인지 확인해 주세요.',true);});
    });
  }catch{$('connection').textContent='연결 실패';message('공동 저장 연결에 실패했습니다. 인터넷과 서비스 설정을 확인해 주세요.',true);}
}
boot();

// Tools hand off a reviewed draft in memory; no URL or localStorage transfer.
const toolPaths={'home-dashboard.html':'첫 집 · 다음 집 대시보드','guide.html':'가족 식사 계산기 · 백업'};
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{
  if($('guideTool').hasAttribute('src')&&!confirm('열린 도구를 바꾸면 저장하지 않은 입력이 사라져요. 계속할까요?'))return;
  $('toolTitle').textContent=toolPaths[b.dataset.tool];$('toolPanel').hidden=false;
  $('guideTool').src=b.dataset.tool;$('toolPanel').scrollIntoView({behavior:'smooth'});
});
$('closeTool').onclick=()=>{if(!confirm('JSON 백업을 마쳤나요? 도구의 저장하지 않은 입력을 비울까요?'))return;$('guideTool').removeAttribute('src');$('toolPanel').hidden=true;};
window.addEventListener('message',e=>{
  if(saving||attachments.isBusy())return;
  if(e.origin!==location.origin||e.source!==$('guideTool').contentWindow)return;
  const d=e.data;if(!d||d.type!=='wedding-draft-v1'||!['호텔','신혼집','촬영','가족 일정','예산','혼인신고','기타'].includes(d.category))return;
  if(typeof d.title!=='string'||!d.title.trim()||d.title.length>160||typeof d.body!=='string'||d.body.length>4000||!Number.isFinite(d.amount)||d.amount<0||d.amount>1e9)return;
  if((editing||$('title').value||$('body').value||$('nextAction').value||attachments.hasPending())&&!confirm('작성 중인 기록과 선택 파일을 도구의 초안으로 바꿀까요?'))return;
  resetForm();for(const k of ['title','body','category','amount'])$(k).value=d[k];$('amountKind').value=d.amount?'예상':'미분류';
  if(typeof d.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.date))$('date').value=d.date;
  tab('journal');updateExamples();$('title').focus();message('도구의 초안을 가져왔어요. 민감한 내용과 금액을 확인한 뒤 공동 저장하고, 저장된 기록에서 노션에 보내기를 눌러 주세요.');
});
if(location.hash==='#guide')tab('guide');
