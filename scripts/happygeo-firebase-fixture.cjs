// Test-only in-memory Firebase compat substitute. Never loads or calls Firebase.
// This verifies the client contract, NOT deployed Realtime Database Rules.
exports.installFirebaseFixture = async function(page, { teacher = false, denied = false } = {}) {
  await page.addInitScript(({teacher, denied}) => {
    const initial = { energyMatchV10_3: { TEST26: {
      meta: { className: '가상 학생 테스트반', active: true },
      students: { 'virtual-student': { uid:'virtual-student', no:'99', name:'가상학생',
        answers:{1:{legacy:'preserve'}}, scores:{1:7}, interests:{coal:true}, mix:{legacy:true} } }, messages:{}
    } } };
    const data = JSON.parse(sessionStorage.getItem('happygeo-fixture') || JSON.stringify(initial));
    const user = teacher ? {uid:'virtual-teacher',email:'fixture-teacher@example.invalid',isAnonymous:false} : {uid:'virtual-student',isAnonymous:true};
    const operations = []; const listeners = [];
    const read = path => path.split('/').filter(Boolean).reduce((o,k)=>o?.[k],data);
    const snapshot = path => ({val:()=>structuredClone(read(path) ?? null),exists:()=>read(path)!=null});
    function check(path, write) {
      operations.push({path,write});
      if(denied || (write && window.__happygeoFixture?.denyWrites)) throw Object.assign(new Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'});
      const parts=path.split('/').filter(Boolean);
      if(parts[0]!=='energyMatchV10_3'||parts[1]!=='TEST26') throw new Error('Fixture path outside isolated class');
      if(!teacher && !(parts[2]==='meta'&&!write) && !(parts[2]==='messages'&&!write) && !(parts[2]==='students'&&parts[3]===user.uid)) throw Object.assign(new Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'});
    }
    function write(path,value,merge){check(path,true);const parts=path.split('/').filter(Boolean);let obj=data;for(const k of parts.slice(0,-1))obj=obj[k]??={};const key=parts.at(-1);obj[key]=merge?{...obj[key],...structuredClone(value)}:structuredClone(value);sessionStorage.setItem('happygeo-fixture',JSON.stringify(data));listeners.forEach(l=>l.cb(snapshot(l.path)));return Promise.resolve()}
    const db={ref(path){return {once:async()=>{check(path,false);return snapshot(path)},get:async()=>{check(path,false);return snapshot(path)},update:value=>write(path,value,true),set:value=>write(path,value,false),on(event,cb,error){try{check(path,false);listeners.push({path,cb});cb(snapshot(path))}catch(e){if(error)error(e);else throw e}},off(){},push(value){const id='fixture-'+Date.now();if(value)return write(path+'/'+id,value,false);return db.ref(path+'/'+id)},onDisconnect(){return {update:async()=>{},set:async()=>{}}}}}};
    const authListeners=[];
    function authChange(value){auth.currentUser=value;authListeners.forEach(cb=>cb(value));return {user:value}}
    const auth={currentUser:null,signInAnonymously:async()=>authChange(user),onAuthStateChanged(cb){authListeners.push(cb);queueMicrotask(()=>cb(auth.currentUser));return ()=>{const i=authListeners.indexOf(cb);if(i>=0)authListeners.splice(i,1)}},signInWithPopup:async()=>authChange(user),signInWithEmailAndPassword:async()=>authChange(user),signOut:async()=>{authChange(null)}};
    const authFn=()=>auth;authFn.GoogleAuthProvider=function(){this.setCustomParameters=()=>{}};
    window.firebase={apps:[],initializeApp(){window.firebase.apps.push({})},auth:authFn,database:()=>db};
    window.__happygeoFixture={data,operations};
  },{teacher,denied});
};
