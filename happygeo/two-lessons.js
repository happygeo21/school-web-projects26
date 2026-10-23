import {renderEnergyMap} from './energy-map.js';
import {createStore,VERSION} from './two-lessons-store.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=async path=>{const r=await fetch(path);if(!r.ok)throw new Error(`자료를 불러오지 못했습니다: ${path}`);return r.json();};
let toastTimer;
function notify(message,error=false){$('toast').textContent=message;$('toast').hidden=false;$('toast').classList.toggle('error',error);clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function failure(error){console.error(error);notify('처리 실패: '+(error.code||error.message)+' · 연결과 학급 권한을 확인하세요.',true);}
const safe=handler=>async event=>{try{await handler(event);}catch(error){failure(error);}};
const names={pokemon:['카르보','페트로','메테온','뉴클론','아쿠엘','윈디온','솔라빔','바이리프','지오라'],mascot:['탄몽이','페트리','가온이','코어링','물결이','바람콩','해봄이','새로미','땅온이'],disney:['카본','페트라','메테아','노바','마리나','아리아','솔레나','플로라','테라']};
let content,characters,store;
const empty=()=>({schemaVersion:VERSION,theme:'pokemon',interests:{},answers:{1:{},2:{}},team:[],teamReason:'',firstTeam:[],firstReason:'',firstAt:null,finalReport:'',mapReason:'',missionId:'supply',missionResponses:{}});
let state=empty(),joined=false,saveQueue=Promise.resolve(),dirty=false,revision=0;
function normalized(value){
 const s=empty();if(!value||value.schemaVersion!==VERSION)return s;
 if(names[value.theme])s.theme=value.theme;
 for(const id of Object.keys(characters))if(value.interests?.[id])s.interests[id]=true;
 for(const l of [1,2])for(let i=0;i<5;i++){const a=value.answers?.[l]?.[i];if(Number.isInteger(a)&&a>=0&&a<4)s.answers[l][i]=a;}
 s.team=[...new Set((Array.isArray(value.team)?value.team:[]).filter(id=>characters[id]))].slice(0,3);
 s.firstTeam=[...new Set((Array.isArray(value.firstTeam)?value.firstTeam:[]).filter(id=>characters[id]))].slice(0,3);
 s.firstAt=Number.isFinite(value.firstAt)?value.firstAt:null;
 for(const key of ['teamReason','mapReason','firstReason','finalReport'])s[key]=String(value[key]||'').slice(0,1500);
 if(content.missions.some(m=>m.id===value.missionId))s.missionId=value.missionId;
 for(const m of content.missions)if(value.missionResponses?.[m.id])s.missionResponses[m.id]=String(value.missionResponses[m.id]).slice(0,1500);
 return s;
}
function score(s,l){return content.questions[l].reduce((sum,q,i)=>sum+(s.answers?.[l]?.[i]===q[2]?1:0),0);}
function answered(s,l){return Object.keys(s.answers?.[l]||{}).filter(i=>Number.isInteger(+i)&&+i>=0&&+i<5&&Number.isInteger(s.answers[l][i])).length;}
function complete(s){return answered(s,1)+answered(s,2)===10&&s.firstTeam.length===3&&s.team.length===3&&s.teamReason.trim()&&s.mapReason.trim()&&s.finalReport.trim()&&Object.values(s.missionResponses).some(t=>t.trim());}
function charName(id){return names[state.theme][Object.keys(characters).indexOf(id)];}
function draft(){if($('teamReason')){state.teamReason=$('teamReason').value.trim();state.mapReason=$('mapReason').value.trim();state.finalReport=$('finalReport').value.trim();state.missionResponses[state.missionId]=$('missionReason').value.trim();}}
async function save(){
 draft();dirty=true;revision++;updateReport();
 if(!joined){$('saveStatus').textContent='미저장 · 학급에 입장한 뒤 저장하세요.';notify('입장 전에는 화면에서만 체험합니다. 학급에 입장한 뒤 저장하세요.');return;}
 const snapshot=JSON.parse(JSON.stringify(state)),savedRevision=revision;$('saveStatus').textContent='저장 중…';
 saveQueue=saveQueue.catch(()=>{}).then(()=>store.save(snapshot));
 try{await saveQueue;if(savedRevision===revision){dirty=false;$('saveStatus').textContent='✅ '+new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'})+' 저장 완료'+(store.demo?' · 이 브라우저 데모 저장소':' · Firebase');}}
 catch(e){$('saveStatus').textContent='⚠️ 저장 실패 · 화면 내용을 유지합니다. 연결·권한 확인 후 다시 저장하세요.';throw e;}
}
function renderProfiles(){
 $('profileGrid').innerHTML=Object.entries(characters).map(([id,c])=>`<article class="card profile"><img src="assets/profiles/${state.theme}/${id}.jpg" alt="${escape(charName(id))} ${escape(c.name)} 캐릭터" loading="lazy"><div class="body"><div class="kicker">${escape(c.type)}</div><h3>${c.icon} ${escape(charName(id))}</h3><small>${escape(c.name)} · ${escape(c.monster)}</small><p>${escape(c.line)}</p><div>${c.tags.map(t=>`<span class="tag">${escape(t)}</span>`).join('')}</div><div class="row" style="margin-top:12px"><button class="heart" data-interest="${id}" aria-pressed="${!!state.interests[id]}">${state.interests[id]?'💗 관심 중':'♡ 관심'}</button><button data-profile="${id}">프로필</button><button class="scout" data-scout="${id}" aria-pressed="${state.team.includes(id)}">${state.team.includes(id)?'영입 완료':'스카우트'}</button></div></div></article>`).join('');
 document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.theme===state.theme));
 $('profileGrid').querySelectorAll('[data-interest]').forEach(b=>b.onclick=safe(async()=>{const id=b.dataset.interest;state.interests[id]=!state.interests[id];renderProfiles();notify(state.interests[id]?`${charName(id)}: “관심 고마워! 내 약점도 함께 봐줘.”`:'관심을 취소했어요.');await save();}));
 $('profileGrid').querySelectorAll('[data-scout]').forEach(b=>b.onclick=safe(async()=>{const id=b.dataset.scout;if(state.team.includes(id))state.team=state.team.filter(x=>x!==id);else if(state.team.length<3)state.team.push(id);else return notify('팀 정원은 3명입니다. 기존 팀원 한 명을 해제한 뒤 영입하세요.');renderProfiles();renderTeam();await save();}));
 $('profileGrid').querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>{const id=b.dataset.profile,c=characters[id];$('profileDetail').innerHTML=`<img src="assets/profiles/${state.theme}/${id}.jpg" alt="${escape(c.name)}"><h2>${escape(charName(id))} · ${escape(c.name)}</h2><p>${escape(c.line)}</p><dl>${Object.entries(c.detail).map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')}</dl>`;$('profileDialog').showModal();});
 updateReport();
}
function renderTeam(){const roles=['지역 조건 담당','안정성 보완 담당','환경·수요 담당'];$('teamSlots').innerHTML=roles.map((role,i)=>`<div class="team-slot"><small>ROLE 0${i+1} · ${role}</small><br><b>${state.team[i]?escape(charName(state.team[i])+' · '+characters[state.team[i]].name):'아직 빈자리예요'}</b></div>`).join('');renderFirstTeam();updateReport();}
function renderFirstTeam(){
 const confirmed=state.firstTeam.length===3;
 $('confirmFirstTeam').disabled=confirmed;
 $('firstTeamStatus').textContent=confirmed?'첫 선택 보존: '+state.firstTeam.map(id=>characters[id].name).join(' · ')+' / 근거: '+state.firstReason:'첫 팀 3명과 근거를 작성하고 첫 선택을 확정하세요. 이후 팀을 바꿔도 첫 기록은 보존됩니다.';
 for(const id of ['missionSelect','drawMission','saveMission'])$(id).disabled=!confirmed;
}

function renderQuestions(){for(const l of [1,2]){
 $('questions'+l).innerHTML=content.questions[l].map((q,i)=>{const a=state.answers[l][i];return `<article class="card quiz"><fieldset><legend>${(l-1)*5+i+1}. ${escape(q[0])}</legend><div class="options">${q[1].map((o,j)=>`<button data-l="${l}" data-q="${i}" data-a="${j}" aria-pressed="${a===j}">${escape(o)}</button>`).join('')}</div></fieldset><p class="feedback" aria-live="polite">${a===undefined?'답을 고르면 해설을 확인할 수 있어요.':(a===q[2]?'✅ 정답 · ':'다시 생각해봐요 · ')+escape(q[3])}</p></article>`;}).join('');
 $('questions'+l).querySelectorAll('button').forEach(b=>b.onclick=safe(async()=>{draft();state.answers[b.dataset.l][b.dataset.q]=+b.dataset.a;const focused={...b.dataset};renderQuestions();document.querySelector(`[data-l="${focused.l}"][data-q="${focused.q}"][data-a="${focused.a}"]`).focus({preventScroll:true});await save();}));
 }updateReport();}
function updateReport(){if(!$('totalScore'))return;for(const l of [1,2]){$('score'+l).textContent=score(state,l)+'/5';$('progress'+l).value=answered(state,l);}$('totalScore').textContent=(score(state,1)+score(state,2))+'/10';$('answeredCount').textContent=(answered(state,1)+answered(state,2))+'/10';$('interestCount').textContent=Object.values(state.interests).filter(Boolean).length+'명';$('teamCount').textContent=state.team.length+'/3';$('completion').textContent=complete(state)?'🎉 문항·지도 메모·드림팀·돌발 대응·개인 보고서를 모두 작성했어요. 저장 상태를 확인하고 팀의 근거를 발표하세요.':'완주 체크: 10문항 + 지도 메모 + 첫 팀 확정 + 팀원 3명과 제안서 + 돌발 대응 + 개인 3문장 보고서를 작성하세요.';}
function renderMission(){const m=content.missions.find(m=>m.id===state.missionId);$('missionSelect').value=m.id;$('missionTitle').textContent=m.title;$('missionPrompt').textContent=m.prompt;$('missionHint').textContent=m.lookFor.join(' · ');$('missionReason').value=state.missionResponses[m.id]||'';}
async function renderWorld(){await renderEnergyMap({json,escape,$});}

async function student(){
 renderProfiles();renderTeam();renderQuestions();renderMission();$('scoutInstruction').textContent=content.scout.instruction;
 $('missionSelect').innerHTML=content.missions.map(m=>`<option value="${m.id}">${escape(m.title)}</option>`).join('');renderMission();
 $('textbookLinks').innerHTML=Array.from({length:13},(_,i)=>`<a class="button" href="assets/textbook/p${String(i+4).padStart(2,'0')}.jpg" target="_blank" rel="noopener">자료 ${i+4}</a>`).join('');
 document.querySelectorAll('[data-theme]').forEach(b=>b.onclick=safe(async()=>{state.theme=b.dataset.theme;renderProfiles();renderTeam();await save();}));
 $('joinForm').onsubmit=safe(async e=>{e.preventDefault();$('joinBtn').disabled=true;try{const result=await store.join($('classCode').value,$('studentNo').value,$('studentName').value);joined=true;state=normalized(result.record);$('mapReason').value=state.mapReason;$('teamReason').value=state.teamReason;$('finalReport').value=state.finalReport;renderProfiles();renderTeam();renderQuestions();renderMission();$('joinStatus').textContent='✅ '+result.meta.className+' 입장 완료 · 저장된 활동을 불러왔어요.';$('classCode').disabled=true;$('studentNo').disabled=true;$('studentName').disabled=true;$('joinBtn').textContent='입장 완료';await save();store.watchMessages(messages=>{const latest=Object.values(messages).filter(m=>m.text).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0];$('teacherMessage').hidden=!latest;$('teacherMessage').textContent=latest?'📢 '+latest.text:'';},failure);}finally{$('joinBtn').disabled=joined;}});
 $('confirmFirstTeam').onclick=safe(async()=>{draft();if(state.firstTeam.length===3)return;if(state.team.length!==3||!state.teamReason)throw new Error('팀원 3명과 지리적 근거를 먼저 작성하세요.');state.firstTeam=[...state.team];state.firstReason=state.teamReason;state.firstAt=Date.now();renderFirstTeam();await save();});
 $('downloadReport').onclick=()=>{draft();const report='에너지 결정사 · 개인 매칭 보고서\n첫 팀: '+state.firstTeam.map(id=>characters[id].name).join(', ')+'\n첫 근거: '+state.firstReason+'\n최종 팀: '+state.team.map(id=>characters[id].name).join(', ')+'\n현재 제안서: '+state.teamReason+'\n\n지도 메모: '+state.mapReason+'\n\n'+content.missions.filter(m=>state.missionResponses[m.id]).map(m=>m.title+'\n'+state.missionResponses[m.id]).join('\n\n')+'\n\n개인 3문장 보고서\n'+state.finalReport;const url=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='에너지결정사_개인보고서.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('saveMap').onclick=safe(save);$('saveAll').onclick=safe(save);
 $('saveTeam').onclick=safe(async()=>{if(state.team.length!==3||!$('teamReason').value.trim())throw new Error('팀원 3명과 제안서를 먼저 작성하세요.');await save();});
 $('saveMission').onclick=safe(async()=>{if(!$('missionReason').value.trim())throw new Error('상황에 대한 대응을 적어주세요.');await save();});
 function changeMission(id){draft();state.missionId=id;renderMission();dirty=true;revision++;}
 $('missionSelect').onchange=()=>changeMission($('missionSelect').value);
 $('drawMission').onclick=()=>{const options=content.missions.filter(m=>m.id!==state.missionId);changeMission(options[Math.floor(Math.random()*options.length)].id);};
 for(const id of ['teamReason','mapReason','missionReason','finalReport'])$(id).oninput=()=>{dirty=true;revision++;draft();updateReport();$('saveStatus').textContent='작성 중 · 저장 버튼으로 제출하세요.';};
 $('closeProfile').onclick=()=>$('profileDialog').close();
 window.addEventListener('beforeunload',e=>{if(dirty&&joined){e.preventDefault();e.returnValue='';}});
 await renderWorld();
}
async function teacher(){
 let all={},active=false;
 $('loginPanel').hidden=store.demo;
 $('googleLogin').onclick=safe(async()=>{await store.login('google');$('loginStatus').textContent='로그인 완료 · 학급을 열어 권한을 확인하세요.';});
 $('loginForm').onsubmit=safe(async e=>{e.preventDefault();await store.login('email',$('email').value,$('password').value);$('password').value='';$('loginStatus').textContent='로그인 완료 · 학급을 열어 권한을 확인하세요.';});
 function showStudent(id){const student=all[id],s=normalized(student[VERSION]);$('studentTitle').textContent=student.no+'번 '+student.name;$('studentDetail').textContent=`1차시 ${score(s,1)}/5 · 2차시 ${score(s,2)}/5\n관심: ${Object.keys(s.interests).filter(id=>s.interests[id]).map(id=>characters[id].name).join(', ')}\n\n지도 메모\n${s.mapReason||'미작성'}\n\n첫 선택: ${s.firstTeam.map(id=>characters[id].name).join(', ')}\n첫 근거: ${s.firstReason||'미확정'}\n\n개인 3문장 보고서\n${s.finalReport||'미작성'}\n\n최종 드림팀: ${s.team.map(id=>characters[id].name).join(', ')}\n${s.teamReason||'미작성'}\n\n${content.missions.map(m=>m.title+'\n'+(s.missionResponses[m.id]||'미작성')).join('\n\n')}`;$('studentDialog').showModal();}
 function render(){const entries=Object.entries(all).filter(([,s])=>s?.[VERSION]?.schemaVersion===VERSION),n=entries.length,records=entries.map(([,s])=>normalized(s[VERSION]));$('mCount').textContent=n;$('mLegacy').textContent=Object.keys(all).length-n;$('mAverage').textContent=(n?records.reduce((sum,s)=>sum+score(s,1)+score(s,2),0)/n:0).toFixed(1)+'/10';$('mComplete').textContent=(n?Math.round(records.filter(complete).length/n*100):0)+'%';
  for(const l of [1,2]){$('lessonAverage'+l).textContent='평균 '+(n?records.reduce((sum,s)=>sum+score(s,l),0)/n:0).toFixed(1)+'/5 · 참여 '+n+'명';$('stats'+l).innerHTML=content.questions[l].map((q,i)=>{const respondents=records.filter(s=>s.answers[l][i]!==undefined),correct=respondents.filter(s=>s.answers[l][i]===q[2]).length;return `<div><b>${(l-1)*5+i+1}번 · ${respondents.length?Math.round(correct/respondents.length*100):0}%</b>정답 ${correct} / 응답 ${respondents.length}</div>`;}).join('');}
  $('interestSummary').innerHTML=Object.entries(characters).map(([id,c])=>`<span class="tag">${escape(c.name)} ♡${records.filter(s=>s.interests[id]).length} · 팀${records.filter(s=>s.team.includes(id)).length}</span>`).join('');
  const query=$('studentSearch').value.trim().toLowerCase();$('studentRows').innerHTML=entries.filter(([,s])=>(s.no+' '+s.name).toLowerCase().includes(query)).map(([id,student])=>{const s=normalized(student[VERSION]);return `<tr><td>${escape(student.no)}번 ${escape(student.name)}</td><td>${score(s,1)}/5</td><td>${score(s,2)}/5</td><td>${score(s,1)+score(s,2)}/10</td><td>${answered(s,1)+answered(s,2)}/10</td><td>${escape(s.team.map(id=>characters[id].name).join(' · '))}<br>${s.teamReason?'제안서 작성':'제안서 대기'}</td><td>${Object.values(s.missionResponses).filter(t=>t.trim()).length}건</td><td><button data-student="${escape(id)}">상담 보기</button></td></tr>`;}).join('')||'<tr><td colspan="8">새 활동 기록이 없습니다.</td></tr>';$('studentRows').querySelectorAll('button').forEach(b=>b.onclick=()=>showStudent(b.dataset.student));
 }
 async function open(create=false){active=false;$('dashboard').hidden=true;all={};const meta=await store.openClass($('classCode').value,$('className').value.slice(0,60),create);$('classTitle').textContent=meta.className||$('classCode').value;$('classStatus').textContent='학급 메타 확인 완료 · 학생 조회 권한 확인 중…';store.watchStudents(data=>{all=data;active=true;$('dashboard').hidden=false;$('classStatus').textContent='✅ 학급과 학생 기록 조회 완료';render();},error=>{active=false;all={};$('dashboard').hidden=true;$('classStatus').textContent='학생 기록 접근이 거부되었습니다. 교사 권한과 서버 규칙을 확인하세요.';failure(error);});}
 $('classForm').onsubmit=safe(async e=>{e.preventDefault();await open();});$('createClass').onclick=safe(()=>open(true));$('studentSearch').oninput=render;$('closeStudent').onclick=()=>$('studentDialog').close();
 $('logout').onclick=safe(async()=>{await store.logout();all={};active=false;$('dashboard').hidden=true;$('loginStatus').textContent='로그아웃했습니다.';$('classStatus').textContent='학급을 다시 열어주세요.';});
 $('sendMessage').onclick=safe(async()=>{if(!active)throw new Error('권한 있는 학급을 먼저 여세요.');await store.message($('messageInput').value);$('messageInput').value='';$('messageStatus').textContent='✅ 메시지 저장 완료';});
 $('answerKey').innerHTML=[1,2].map(l=>`<h3>${l}차시 정답과 해설</h3>${content.questions[l].map((q,i)=>`<p><b>${(l-1)*5+i+1}번 · ${q[2]+1}번 선택지</b> ${escape(q[3])}</p>`).join('')}`).join('');
}
async function init(){
 [content,characters]=await Promise.all([json('lesson-content.json'),json('energy-characters.json')]);
 store=await createStore(document.body.dataset.role==='teacher');
 $('connection').textContent=store.demo?'🧪 격리 데모 · 가상 학생만 입력하세요. Firebase에 연결하지 않으며 같은 브라우저에서만 저장·조회합니다.':'인증 준비 완료 · 학급 접근·저장은 Firebase 서버 권한으로 확인합니다.';
 if(document.body.dataset.role==='teacher')await teacher();else await student();
}
init().catch(error=>{$('connection').textContent='연결 실패 · '+(error.code||error.message)+' · 새로고침 후 다시 시도하세요.';$('connection').classList.add('error');document.querySelectorAll('form button').forEach(b=>b.disabled=true);failure(error);});
