// Existing Firebase is a GET-only source. No records are copied into the V2 database.
import{initializeApp,getApps}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';import{getAuth,signInWithEmailAndPassword}from'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
const origin='https://school-project-26-1edf4-default-rtdb.asia-southeast1.firebasedatabase.app',base='memoryTemperature2026';
export async function legacyGET(path,token){if(!/^(published|submissions|audit)(\/[A-Za-z0-9_-]+)*$/.test(path))throw Error('Existing read path refused');const u=new URL(origin+'/'+base+'/'+path+'.json');if(token)u.searchParams.set('auth',token);const r=await fetch(u,{method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw{code:'permission-denied'};return r.json();}
export async function readLegacyPublic(){const data=await legacyGET('published')||{},result={};for(const[k,v]of Object.entries(data)){const digest='p_'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(k))),b=>b.toString(16).padStart(2,'0')).join('');if(!k.startsWith('p_')&&data[digest])continue;result[k]=v;}return result;}

export async function enableLegacyTeacher(config,container){
  if(config.projectId!=='school-project-26-1edf4')throw Error('Existing read target mismatch');
  const {setupTeacherLogin}=await import('./teacher-login.js');
  const note=document.createElement('p');note.textContent='기존 운영 교사 전용 · 원본 읽기 전용 연결입니다. V2 가상 교사 로그인과 별개이며, 기존 계정·비밀번호·Rules를 변경하지 않습니다. 기존에 이메일·비밀번호 로그인을 쓰는 계정만 같은 방식으로 연결하세요.';
  const emailLabel=document.createElement('label');emailLabel.textContent='기존 운영 교사 이메일';const email=document.createElement('input');email.type='email';email.autocomplete='off';emailLabel.append(email);
  const passwordLabel=document.createElement('label');passwordLabel.textContent='기존 운영 Firebase 비밀번호';const password=document.createElement('input');password.type='password';password.autocomplete='off';passwordLabel.append(password);
  const passwordButton=document.createElement('button');passwordButton.type='button';passwordButton.textContent='기존 계정으로 원본 읽기 전용 연결';
  const google=document.createElement('button');google.type='button';google.textContent='기존 Google 교사 연결 · 현재 보류';google.disabled=true;
  const googleNote=document.createElement('p');googleNote.textContent='Google 전용 계정은 현재 V2 주소의 인증 도메인 조건 때문에 연결 보류입니다. V1 설정은 바꾸지 않았습니다. 비밀번호를 추정하거나 새로 설정하지 마세요. V2 신규 제출 관리 권한도 이 연결로 부여되지 않습니다.';
  const message=document.createElement('p');message.setAttribute('role','status');message.id='legacyConnectionStatus';const summary=document.createElement('p');summary.id='legacyReadSummary';const list=document.createElement('div');list.id='legacyReadList';
  container.append(note,emailLabel,passwordLabel,passwordButton,google,googleNote,message,summary,list);
  const getLegacyAuth=()=>{const app=getApps().find(a=>a.name==='legacy-read-only')||initializeApp(config,'legacy-read-only');return getAuth(app)};
  let control;
  async function loadPrivate(user){
    control.status('database');
    try{const records=await legacyGET('submissions',await user.getIdToken());let count=0;const schools={};list.replaceChildren();
      for(const[s,users]of Object.entries(records||{})){schools[s]=0;for(const items of Object.values(users||{}))for(const record of Object.values(items||{})){count++;schools[s]++;const details=document.createElement('details'),title=document.createElement('summary'),body=document.createElement('p');title.textContent='기존 기록 · '+s+' · '+(record.placeName||'장소');body.textContent=(record.placeDescription||'')+' · '+(record.rememberSentence||'');details.append(title,body);list.append(details);}}
      summary.textContent='기존 원본 '+count+'건 · 읽기 전용 · 학교별 '+Object.entries(schools).map(([s,n])=>s+':'+n).join(', ')+' · V2 신규 기록과 별도 표시';summary.dataset.count=String(count);control.status('ready');
    }catch(e){list.replaceChildren();summary.textContent='기존 원본 읽기를 완료하지 못했습니다. 기록 복사·수정은 실행하지 않았습니다.';control.status('database',e);}
  }
  control=setupTeacherLogin({projectId:config.projectId,allowGoogle:false,elements:{google,passwordButton,email,password,message},authenticateGoogle:async()=>{throw{code:'auth/unauthorized-domain'}},authenticatePassword:async(e,p)=>{const credential=await signInWithEmailAndPassword(getLegacyAuth(),e,p);await loadPrivate(credential.user)}});
  // No Google request is made while the existing production domain remains unapproved.
  google.disabled=true;
}
