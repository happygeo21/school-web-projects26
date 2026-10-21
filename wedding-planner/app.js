import {cloudConfig, notionEnabled, notionEndpoint} from './cloud-config.js';
const $ = id => document.getElementById(id);
let api, auth, db, allowed = false, records = [], stopRecords, stopMember;
let editing = null, generation = 0, saving = false, exporting = false;
const localDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
const message = (text, error = false) => { $('notice').textContent=text; $('notice').classList.toggle('error',error); };
function tab(name) {
  document.querySelectorAll('.view').forEach(el => el.hidden=el.id!==name);
  document.querySelectorAll('[data-tab]').forEach(el => el.setAttribute('aria-selected',String(el.dataset.tab===name)));
}
document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>tab(el.dataset.tab));
document.querySelectorAll('[data-template]').forEach(el=>el.onclick=()=>{tab('journal');$('category').value=el.dataset.template;$('title').focus();});
function resetForm() { editing=null; $('recordForm').reset(); $('date').value=localDate();$('formTitle').textContent='새 기록 남기기';$('cancelEdit').hidden=true; }
function clearPrivate() {
  stopRecords?.();stopRecords=null;records=[];allowed=false;resetForm();render();
  $('save').disabled=true;$('backup').disabled=true;$('loginPanel').hidden=false;
}
function button(text,fn) { const el=document.createElement('button');el.type='button';el.textContent=text;el.onclick=fn;return el; }
function card(r) {
  const el=document.createElement('article');el.className='record';
  const meta=document.createElement('div');meta.className='meta';meta.textContent=`${r.date} · ${r.category} · ${r.status}`;
  const title=document.createElement('h3');title.textContent=r.title;
  const body=document.createElement('p');body.textContent=r.body;
  el.append(meta,title,body);
  if(r.amount){const amount=document.createElement('p');amount.textContent=`관련 금액 ${r.amount.toLocaleString('ko-KR')}원`;el.append(amount);}
  const actions=document.createElement('div');actions.className='actions';
  actions.append(button('수정하기',()=>{
    if(!allowed)return;editing={id:r.id,revision:r.revision};
    for(const key of ['title','body','category','status','date','amount'])$(key).value=r[key];
    $('formTitle').textContent='기록 수정하기';$('cancelEdit').hidden=false;tab('journal');$('title').focus();
  }));
  if(notionEnabled)actions.append(button('노션에 보내기',async()=>{
    if(!allowed||exporting||!auth.currentUser||!confirm('이 기록의 제목·내용·날짜·분야·상태를 Cloudflare 전송 서버를 거쳐 노션 공동 기록 DB로 보낼까요? 관련 금액은 보내지 않습니다.'))return;
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
  el.append(actions);return el;
}
function render() {
  const selected=records.filter(r=>$('filter').value==='전체'||r.category===$('filter').value);
  $('records').replaceChildren(...selected.map(card));
  if(!selected.length){const p=document.createElement('p');p.className='empty';p.textContent=allowed?'아직 기록이 없어요. 첫 소식을 남겨 주세요.':'로그인 후 공동 기록을 확인할 수 있어요.';$('records').append(p);}
  const todos=records.filter(r=>r.status!=='완료');$('todoList').replaceChildren(...todos.map(card));
  if(!todos.length){const p=document.createElement('p');p.className='empty';p.textContent=allowed?'남은 할 일이 없어요. 새 계획을 함께 남겨 보세요.':'로그인하면 우리 할 일이 여기에 모여요.';$('todoList').append(p);}
  const done=records.length-todos.length;$('counts').textContent=allowed?`${done} / ${records.length} 완료`:'로그인 후 표시';
  $('progress').style.width=(records.length?done/records.length*100:0)+'%';
}
$('filter').onchange=render;$('cancelEdit').onclick=resetForm;
$('recordForm').onsubmit=async e=>{
  e.preventDefault();if(!allowed||saving||!auth.currentUser)return;
  if(!navigator.onLine){message('오프라인입니다. 인터넷 연결 후 저장해 주세요. 입력 내용은 아직 공동 저장되지 않았습니다.',true);return;}
  const epoch=generation,uid=auth.currentUser.uid,target=editing?{...editing}:null;
  const values={};for(const key of ['title','body','category','status','date'])values[key]=$(key).value.trim();
  values.amount=Number($('amount').value||0);
  if(!values.title||!Number.isFinite(values.amount)||values.amount<0||values.amount>1e9)return;
  saving=true;$('save').disabled=true;message('공동 저장 중… 이 화면을 닫지 마세요.');
  try {
    const ref=target?api.doc(db,'records',target.id):api.doc(api.collection(db,'records'));
    await api.runTransaction(db,async tx=>{
      if(epoch!==generation||!allowed)throw Error('권한이 변경되었습니다.');
      const snap=await tx.get(ref);
      if(target&&(!snap.exists()||snap.data().revision!==target.revision))throw Error('다른 사람이 이 기록을 수정했어요. 수정 취소 후 최신 기록을 열어 다시 반영해 주세요.');
      tx.set(ref,{...values,revision:target?target.revision+1:1,updatedBy:uid,updatedAt:api.serverTimestamp()});
    });
    if(epoch===generation){resetForm();message('공동 저장 완료 · 두 사람이 같은 기록을 볼 수 있어요.');}
  }catch(err){if(epoch===generation)message(err.code==='resource-exhausted'?'무료 저장 한도에 도달해 저장하지 못했어요. 입력 내용을 복사해 보관하고 한도가 초기화된 뒤 다시 저장해 주세요.':err.message?.startsWith('다른 사람이')?err.message:'저장하지 못했습니다. 입력 내용을 유지했으니 연결과 권한을 확인한 뒤 다시 저장해 주세요.',true);}
  finally{saving=false;$('save').disabled=!allowed;}
};
$('backup').onclick=()=>{
  if(!allowed||!confirm('개인 기록을 이 기기에 파일로 내려받습니다. 공용 기기에서는 저장하지 마세요.'))return;
  const blob=new Blob([JSON.stringify({format:'wedding-records-v2',exportedAt:new Date().toISOString(),records:records.map(({updatedBy,...r})=>r)},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`wedding-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('offline',()=>message('인터넷 연결이 끊겼어요. 화면의 기록은 마지막으로 불러온 내용입니다. 새 입력은 아직 저장되지 않았습니다.',true));
window.addEventListener('online',()=>message('인터넷에 다시 연결되었습니다. 공동 저장 완료 여부를 확인해 주세요.'));
window.addEventListener('beforeunload',e=>{if(saving||$('title').value||$('body').value){e.preventDefault();e.returnValue='';}});
resetForm();render();
if(notionEnabled&&notionEndpoint)$('notionStatus').textContent='기록별 ‘노션에 보내기’로 선택한 내용만 반영해요. 두 사람 합계 하루 200회까지, 같은 버전은 중복 생성하지 않아요. 노션의 수정은 자동으로 돌아오지 않아요.';
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
        if(allowed)return;allowed=true;$('loginPanel').hidden=true;$('save').disabled=false;$('backup').disabled=false;$('connection').textContent='둘만의 공동 공간';
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
