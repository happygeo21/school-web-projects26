// Existing Firebase is a GET-only source. No records are copied into the V2 database.
import{initializeApp,getApps}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';import{getAuth,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,setPersistence,inMemoryPersistence,signOut}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
const origin='https://school-project-26-1edf4-default-rtdb.asia-southeast1.firebasedatabase.app',base='memoryTemperature2026';
export async function legacyGET(path,token){if(!/^(published|submissions|audit)(\/[A-Za-z0-9_-]+)*$/.test(path))throw Error('Existing read path refused');const u=new URL(origin+'/'+base+'/'+path+'.json');if(token)u.searchParams.set('auth',token);const r=await fetch(u,{method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw{code:'permission-denied'};return r.json();}
export async function readLegacyPublic(){const data=await legacyGET('published')||{},result={};for(const[k,v]of Object.entries(data)){const digest='p_'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(k))),b=>b.toString(16).padStart(2,'0')).join('');if(!k.startsWith('p_')&&data[digest])continue;result[k]=v;}return result;}

export async function enableLegacyTeacher(config,container){
  if(config.projectId!=='school-project-26-1edf4')throw Error('Existing read target mismatch');
  const {setupTeacherLogin}=await import('./teacher-login.js');
  const note=document.createElement('p');note.textContent='기존 운영 교사 전용 · 원본 읽기 전용 연결입니다. 아래 신규 작품 테스트 로그인과 별개이며, 기존 계정·비밀번호·Rules를 변경하지 않습니다. 이 읽기 연결은 새로고침하면 끝나며, 조회 후 연결 종료를 눌러 화면을 비우세요. 기존에 사용하던 이메일·비밀번호 또는 Google 계정으로 연결하세요. 담당 학교의 신규 가상 작품 승인은 아래 별도 로그인 영역에서 확인하세요.';
  const emailLabel=document.createElement('label');emailLabel.textContent='기존 운영 교사 이메일';const email=document.createElement('input');email.type='email';email.autocomplete='off';emailLabel.append(email);
  const passwordLabel=document.createElement('label');passwordLabel.textContent='기존 운영 Firebase 비밀번호';const password=document.createElement('input');password.type='password';password.autocomplete='off';passwordLabel.append(password);
  const passwordButton=document.createElement('button');passwordButton.type='button';passwordButton.textContent='기존 계정으로 원본 읽기 전용 연결';
  const google=document.createElement('button');google.type='button';google.textContent='기존 Google 계정으로 원본 읽기 전용 연결';
  const googleNote=document.createElement('p');googleNote.textContent='기존 등록 Google 계정만 선택하세요. V2 호스트의 Google 승인 도메인 등록을 확인했습니다. 비밀번호를 복사·재설정하지 않습니다. 이 연결은 기존 원본 조회 전용입니다. 신규 작품 테스트는 아래 별도 로그인 영역을 이용하세요.';
  const disconnect=document.createElement('button');disconnect.type='button';disconnect.textContent='기존 원본 연결 종료 · 화면 비우기';disconnect.hidden=true;disconnect.disabled=true;
  const message=document.createElement('p');message.setAttribute('role','status');message.id='legacyConnectionStatus';const summary=document.createElement('p');summary.id='legacyReadSummary';const list=document.createElement('div');list.id='legacyReadList';
  container.append(note,emailLabel,passwordLabel,passwordButton,google,googleNote,message,summary,disconnect,list);
  const getLegacyAuth=()=>{const app=getApps().find(a=>a.name==='legacy-read-only')||initializeApp(config,'legacy-read-only');return getAuth(app)};
  let control,authReady=Promise.resolve();
  async function loadPrivate(user){
    control.status('database');
    try{const records=await legacyGET('submissions',await user.getIdToken());let count=0;const schools={};list.replaceChildren();
      for(const[s,users]of Object.entries(records||{})){schools[s]=0;for(const items of Object.values(users||{}))for(const record of Object.values(items||{})){count++;schools[s]++;const details=document.createElement('details'),title=document.createElement('summary'),body=document.createElement('p');title.textContent='기존 기록 · '+s+' · '+(record.placeName||'장소');body.textContent=(record.placeDescription||'')+' · '+(record.rememberSentence||'');details.append(title,body);list.append(details);}}
      summary.textContent='기존 원본 '+count+'건 · 읽기 전용 · 학교별 '+Object.entries(schools).map(([s,n])=>s+':'+n).join(', ')+' · V2 신규 기록과 별도 표시';summary.dataset.count=String(count);disconnect.hidden=false;control.status('ready');
    }catch(e){list.replaceChildren();summary.textContent='기존 원본 읽기를 완료하지 못했습니다. 기록 복사·수정은 실행하지 않았습니다.';control.status('database',e);}
  }
  control=setupTeacherLogin({projectId:config.projectId,allowGoogle:true,prepare:()=>undefined,elements:{google,passwordButton,email,password,message},authenticateGoogle:()=>{const auth=getLegacyAuth();const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});const login=signInWithPopup(auth,provider);return login.then(credential=>loadPrivate(credential.user))},authenticatePassword:async(e,p)=>{const auth=getLegacyAuth();await setPersistence(auth,inMemoryPersistence);const credential=await signInWithEmailAndPassword(auth,e,p);await loadPrivate(credential.user)}});
  // Google uses the same existing Auth project and GET-only reader, not the test approval session.
  disconnect.onclick=async()=>{await authReady;if(control.isBusy())return;await signOut(getLegacyAuth());password.value='';list.replaceChildren();delete summary.dataset.count;summary.textContent='기존 연결을 종료하고 조회 화면을 비웠습니다. 원본은 변경하지 않았습니다.';disconnect.hidden=true;control.status('idle');};
  // Migrate only this V2-origin legacy auth namespace out of persistent storage. No records are fetched automatically.
  authReady=(async()=>{try{const auth=getLegacyAuth();await auth.authStateReady?.();await setPersistence(auth,inMemoryPersistence);if(auth.currentUser){disconnect.hidden=false;summary.textContent='이 탭에 기존 읽기 연결이 남아 있습니다. 자료는 자동 조회하지 않았습니다. 연결 종료로 비우세요.';}}catch{summary.textContent='읽기 연결 준비를 확인하지 못했습니다. 기존 원본은 변경하지 않았습니다.';}finally{disconnect.disabled=false;}})();
  await authReady;
}
