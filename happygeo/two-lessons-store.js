/* Separate curriculum records; legacy student fields are never rewritten. */
export const DEMO_KEY = 'happygeo:lesson2026:demo';
export const VERSION = 'lesson2026';
export const cleanCode = value => value.trim().toUpperCase().replace(/[^A-Z0-9가-힣_-]/g, '').slice(0,20);
const readDemo = () => JSON.parse(localStorage.getItem(DEMO_KEY) || '{}');
const writeDemo = data => localStorage.setItem(DEMO_KEY, JSON.stringify(data));
function loadScript(src) { return new Promise((resolve,reject) => { const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('인증 모듈을 불러오지 못했습니다. 연결을 확인하세요.'));document.head.append(s); }); }
export async function createStore(teacher=false) {
  const demo=new URLSearchParams(location.search).get('demo')==='1';
  let auth,db,code='',uid='',stops=[];
  if(!demo){
    await loadScript('firebase-config.js');
    for(const part of ['app','auth','database']) await loadScript(`https://www.gstatic.com/firebasejs/10.14.1/firebase-${part}-compat.js`);
    if(!firebase.apps.length)firebase.initializeApp(window.ENERGY_FIREBASE_CONFIG);
    auth=firebase.auth(); db=firebase.database();
    await new Promise(resolve=>{const stop=auth.onAuthStateChanged(()=>{stop();resolve();});});
    if(!teacher)await auth.signInAnonymously();
  }
  const root=demo?'':window.ENERGY_APP_SETTINGS?.databaseRoot;
  if(!demo && root!=='energyMatchV10_3')throw new Error('기존 데이터 경로 설정을 확인하세요.');
  const ref=path=>db.ref(`${root}/${code}/${path}`);
  const disconnect=()=>{stops.forEach(s=>s());stops=[];};
  const api={demo,
    async login(method,email,password){if(demo)return;if(method==='google')await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());else await auth.signInWithEmailAndPassword(email,password);},
    async logout(){disconnect();if(!demo)await auth.signOut();code='';uid='';},
    async openClass(value,name,create=false){
      disconnect(); code=cleanCode(value);if(!code)throw new Error('학급 코드를 입력하세요.');
      if(demo){let data=readDemo();if(create){data[code]??={students:{},messages:{}};data[code].meta={className:name||code};writeDemo(data);}if(!data[code]?.meta)throw new Error('교사용 데모에서 학급을 먼저 만드세요.');return data[code].meta;}
      if(teacher && (!auth.currentUser || auth.currentUser.isAnonymous))throw new Error('교사 계정으로 로그인하세요.');
      if(create)await ref('meta').update({className:name||code,updatedAt:Date.now()});
      const snapshot=await ref('meta').once('value');if(!snapshot.exists())throw new Error('등록되지 않은 학급입니다.');return snapshot.val();
    },
    async join(value,no,name){
      const meta=await api.openClass(value);if(!no.trim()||!name.trim())throw new Error('번호와 이름 또는 수업용 별명을 입력하세요.');
      if(demo){uid=sessionStorage.getItem('happygeo:demo:uid')||crypto.randomUUID();sessionStorage.setItem('happygeo:demo:uid',uid);const data=readDemo();data[code].students??={};let student=data[code].students[uid];if(!student)student=data[code].students[uid]={uid,no:no.trim().slice(0,12),name:name.trim().slice(0,40)};writeDemo(data);return {meta,record:student[VERSION]||null};}
      uid=auth.currentUser.uid;const snapshot=await ref(`students/${uid}`).once('value');const student=snapshot.val();
      if(!student)await ref(`students/${uid}`).update({uid,no:no.trim().slice(0,12),name:name.trim().slice(0,40),classCode:code,joinedAt:Date.now()});
      return {meta,record:student?.[VERSION]||null};
    },
    async save(record){
      if(!uid)throw new Error('먼저 학급에 입장하세요.');
      const next={...record,schemaVersion:VERSION,updatedAt:Date.now()};
      if(demo){const data=readDemo();data[code].students[uid][VERSION]=next;writeDemo(data);}else await ref(`students/${uid}/${VERSION}`).set(next);
      return next;
    },
    watchStudents(callback,onError){
      if(!teacher)throw new Error('교사용 기능입니다.');
      if(demo){const update=()=>callback(readDemo()[code]?.students||{});update();window.addEventListener('storage',update);stops.push(()=>window.removeEventListener('storage',update));return;}
      const r=ref('students');const cb=s=>callback(s.val()||{});r.on('value',cb,onError);stops.push(()=>r.off('value',cb));
    },
    watchMessages(callback,onError){
      if(demo){const update=()=>callback(readDemo()[code]?.messages||{});update();window.addEventListener('storage',update);stops.push(()=>window.removeEventListener('storage',update));return;}
      const r=ref('messages'),cb=s=>callback(s.val()||{});r.on('value',cb,onError);stops.push(()=>r.off('value',cb));
    },
    async message(text){if(!teacher)throw new Error('교사용 기능입니다.');const item={text:text.trim().slice(0,500),createdAt:Date.now()};if(!item.text)throw new Error('메시지를 입력하세요.');if(demo){const data=readDemo();data[code].messages??={};data[code].messages[crypto.randomUUID()]=item;writeDemo(data);}else await ref('messages').push(item);},
    disconnect
  };return api;
}
