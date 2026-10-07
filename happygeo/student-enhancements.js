(()=>{
'use strict';

const CHARACTER_NAMES={
  pokemon:{
    coal:'카르보',oil:'페트로',gas:'메테온',nuclear:'뉴클론',hydro:'아쿠엘',
    wind:'윈디온',solar:'솔라빔',bio:'바이리프',geo:'지오라'
  },
  mascot:{
    coal:'탄몽이',oil:'페트리',gas:'가온이',nuclear:'코어링',hydro:'물결이',
    wind:'바람콩',solar:'해봄이',bio:'새로미',geo:'땅온이'
  },
  disney:{
    coal:'카본',oil:'페트라',gas:'메테아',nuclear:'노바',hydro:'마리나',
    wind:'아리아',solar:'솔레나',bio:'플로라',geo:'테라'
  }
};
const RESOURCE={
  coal:{name:'석탄',icon:'🪨',type:'산업·고체'},
  oil:{name:'석유',icon:'🛢️',type:'수송·액체'},
  gas:{name:'천연가스',icon:'🔥',type:'도시·기체'},
  nuclear:{name:'원자력',icon:'⚛️',type:'기저·원자'},
  hydro:{name:'수력',icon:'💧',type:'물·재생'},
  wind:{name:'풍력',icon:'🌬️',type:'바람·재생'},
  solar:{name:'태양광',icon:'☀️',type:'빛·재생'},
  bio:{name:'바이오',icon:'🌱',type:'생물·재생'},
  geo:{name:'지열',icon:'🌋',type:'열·재생'}
};
const THEME_LABEL={pokemon:'몬스터 회원',mascot:'마스코트 회원',disney:'인간형 회원'};

function addStyles(){
  if(document.getElementById('energy-enhancement-style')) return;
  const style=document.createElement('style');
  style.id='energy-enhancement-style';
  style.textContent=`
  .source-card img{cursor:zoom-in;transition:transform .18s ease,filter .18s ease}
  .source-card:hover img{transform:scale(1.025);filter:brightness(.97)}
  .source-card{position:relative}
  .source-card::after{content:"🔍 클릭해서 교과서 크게 보기";position:absolute;left:10px;right:10px;top:10px;padding:7px 9px;border-radius:999px;background:rgba(23,33,58,.86);color:#fff;font-size:11px;font-weight:800;text-align:center;opacity:0;transform:translateY(-4px);transition:.18s;pointer-events:none}
  .source-card:hover::after{opacity:1;transform:none}
  .resource-kicker{font-size:11px;font-weight:900;color:#6258e8;margin-bottom:2px}
  .profile-name{line-height:1.2}
  .profile-resource{display:inline-flex;margin-top:5px;padding:3px 7px;border-radius:999px;background:#f4f2f8;color:#5f6578;font-size:10px;font-weight:800}
  #concept .intro-flow{grid-template-columns:repeat(5,1fr)}
  .student-route{margin-top:16px;padding:18px;border:1px solid #dfe4ee;border-radius:22px;background:linear-gradient(135deg,#fff,#f7f7ff);box-shadow:0 10px 26px rgba(30,39,70,.06)}
  .student-route h3{margin:0 0 6px;font-size:20px}
  .student-route .route-sub{margin:0 0 14px;color:#667086;font-size:13px}
  .route-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}
  .route-card{position:relative;border:1px solid #e2e4ee;border-radius:16px;padding:12px;background:#fff;min-height:145px}
  .route-card:not(:last-child)::after{content:"→";position:absolute;right:-13px;top:50%;transform:translateY(-50%);z-index:2;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#6258e8;color:#fff;font-weight:900}
  .route-num{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#efedff;color:#5148ce;font-weight:900;font-size:12px}
  .route-title{display:block;margin:8px 0 3px;font-weight:900;font-size:14px}
  .route-desc{font-size:11px;color:#687186;line-height:1.45}
  .route-mini{margin-top:9px;border:1px solid #eceef4;background:#f8f9fc;border-radius:10px;padding:8px;font-size:10px;font-weight:800;color:#445}
  .route-mini .bar{height:5px;background:#e6e8f1;border-radius:999px;margin-top:5px;overflow:hidden}
  .route-mini .bar i{display:block;height:100%;width:70%;background:#6258e8;border-radius:999px}
  .route-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
  .route-actions a{padding:7px 10px;border-radius:999px;background:#efedff;color:#5148ce;font-size:11px;font-weight:900}
  .concept-visual{display:none!important}
  #textbookZoomModal{position:fixed;inset:0;z-index:1000;background:rgba(10,14,30,.86);display:none;align-items:center;justify-content:center;padding:22px}
  #textbookZoomModal.open{display:flex}
  .tbz-card{position:relative;width:min(1100px,96vw);max-height:94vh;background:#fff;border-radius:22px;padding:16px;box-shadow:0 24px 80px rgba(0,0,0,.35);display:flex;flex-direction:column}
  .tbz-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  .tbz-title{font-weight:900;flex:1}
  .tbz-close{border:1px solid #dfe4ee;background:#fff;border-radius:10px;padding:7px 11px;font-weight:900;cursor:pointer}
  .tbz-imgwrap{overflow:auto;border-radius:14px;background:#f3f4f7;display:grid;place-items:center}
  .tbz-imgwrap img{display:block;max-width:none;width:auto;height:auto;min-width:min(760px,92vw);max-height:none;cursor:zoom-out}
  .tbz-caption{margin-top:10px;color:#667086;font-size:12px}
  @media(max-width:900px){#concept .intro-flow{grid-template-columns:1fr 1fr}.route-grid{grid-template-columns:1fr 1fr}.route-card:not(:last-child)::after{display:none}}
  @media(max-width:520px){#concept .intro-flow{grid-template-columns:1fr}.route-grid{grid-template-columns:1fr}.student-route{padding:14px}.tbz-card{padding:10px}.tbz-imgwrap img{min-width:100%}}
  `;
  document.head.appendChild(style);
}

function parseProfile(img){
  const src=(img.getAttribute('src')||'').replace(/\\/g,'/');
  const m=src.match(/assets\/profiles\/(pokemon|mascot|disney)\/([^/.]+)\.jpg/i);
  return m?{theme:m[1].toLowerCase(),id:m[2].toLowerCase()}:null;
}

function decorateProfiles(){
  document.querySelectorAll('#profileGrid .profile').forEach(card=>{
    const img=card.querySelector('img');
    const info=img&&parseProfile(img);
    if(!info||!CHARACTER_NAMES[info.theme]||!RESOURCE[info.id]) return;
    const charName=CHARACTER_NAMES[info.theme][info.id];
    const r=RESOURCE[info.id];
    const body=card.querySelector('.profile-body');
    const name=card.querySelector('.profile-name');
    if(name){const wanted=`${r.icon} ${charName}`;if(name.textContent.trim()!==wanted)name.textContent=wanted;}
    let kicker=body&&body.querySelector('.resource-kicker');
    if(body&&!kicker){
      kicker=document.createElement('div');
      kicker.className='resource-kicker';
      body.insertBefore(kicker,body.firstChild);
    }
    if(kicker){const wanted=`${r.name} · ${THEME_LABEL[info.theme]}`;if(kicker.textContent!==wanted)kicker.textContent=wanted;}
    let badge=body&&body.querySelector('.profile-resource');
    if(body&&!badge){
      badge=document.createElement('span');
      badge.className='profile-resource';
      const line=body.querySelector('.profile-line');
      if(line) line.insertAdjacentElement('afterend',badge); else body.appendChild(badge);
    }
    if(badge){const wanted=`${r.name} · ${r.type} 타입`;if(badge.textContent!==wanted)badge.textContent=wanted;}
    const oldMonster=card.querySelector('.monster-name');
    if(oldMonster){const wanted=`${charName} · ${r.type} 타입`;if(oldMonster.textContent!==wanted)oldMonster.textContent=wanted;}
  });
}

function decorateProfileModal(){
  const img=document.getElementById('modalImg');
  const title=document.getElementById('modalName');
  if(!img||!title) return;
  const info=parseProfile(img);
  if(!info||!RESOURCE[info.id]) return;
  const r=RESOURCE[info.id];
  {const wanted=`${r.icon} ${CHARACTER_NAMES[info.theme][info.id]} · ${r.name}`;if(title.textContent!==wanted)title.textContent=wanted;}
}

function createTextbookModal(){
  if(document.getElementById('textbookZoomModal')) return;
  const modal=document.createElement('div');
  modal.id='textbookZoomModal';
  modal.innerHTML=`<div class="tbz-card" role="dialog" aria-modal="true" aria-label="교과서 자료 크게 보기">
    <div class="tbz-head"><div class="tbz-title">📖 교과서 자료 크게 보기</div><button class="tbz-close" type="button">닫기 ✕</button></div>
    <div class="tbz-imgwrap"><img alt="확대한 교과서 자료"></div>
    <div class="tbz-caption"></div>
  </div>`;
  document.body.appendChild(modal);
  const close=()=>modal.classList.remove('open');
  modal.querySelector('.tbz-close').onclick=close;
  modal.addEventListener('click',e=>{if(e.target===modal||e.target.matches('.tbz-imgwrap img')) close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape') close()});
}

function openTextbook(img){
  createTextbookModal();
  const modal=document.getElementById('textbookZoomModal');
  modal.querySelector('.tbz-imgwrap img').src=img.src;
  const card=img.closest('.source-card');
  modal.querySelector('.tbz-caption').textContent=card?.querySelector('p')?.textContent?.trim()||'교과서 자료';
  modal.classList.add('open');
}

function buildRouteGuide(){
  const concept=document.getElementById('concept');
  if(!concept||concept.querySelector('.student-route')) return;
  const flow=concept.querySelector('.intro-flow');
  if(flow){
    flow.innerHTML=`
      <div class="intro-step"><div class="stepno">1</div><b>회원 만나기</b><p>캐릭터 프로필에서 자원의 분포·용도·강점·한계를 먼저 훑습니다.</p></div>
      <div class="intro-step"><div class="stepno">2</div><b>교과서 확대</b><p>교과서 이미지를 눌러 크게 보고, 프로필 설명과 근거를 연결합니다.</p></div>
      <div class="intro-step"><div class="stepno">3</div><b>퀴즈 + 대화</b><p>차시별 7문항을 풀고, 자원 선택의 이유를 짧게 기록합니다.</p></div>
      <div class="intro-step"><div class="stepno">4</div><b>관심 표현</b><p>마음에 드는 회원을 골라 관심을 보내고 자원별 매력을 비교합니다.</p></div>
      <div class="intro-step"><div class="stepno">5</div><b>최종 매칭</b><p>솔바람시 조건을 고려해 에너지 믹스를 100%로 설계합니다.</p></div>`;
  }
  const visual=concept.querySelector('.concept-visual');
  const guide=document.createElement('div');
  guide.className='student-route';
  guide.innerHTML=`
    <h3>🧭 실제 수업은 이렇게 흘러가요</h3>
    <p class="route-sub">화면을 구경하는 활동이 아니라, <b>자료 확인 → 개념 판단 → 선택 근거 작성 → 지역에 맞는 조합</b>으로 이어지는 수업입니다.</p>
    <div class="route-grid">
      <div class="route-card"><span class="route-num">01</span><span class="route-title">프로필 탐색</span><div class="route-desc">자원 회원의 특징과 태그를 비교하고 ‘프로필 자세히’를 눌러 핵심 개념을 확인합니다.</div><div class="route-mini">👤 카르보 · 석탄<br>고기 조산대 · 발전·제철</div></div>
      <div class="route-card"><span class="route-num">02</span><span class="route-title">교과서 근거 확인</span><div class="route-desc">작은 교과서 이미지를 클릭하면 큰 화면으로 열립니다. 설명의 근거를 그림과 표에서 직접 찾습니다.</div><div class="route-mini">📖 이미지 클릭 → 크게 보기<br>🔎 근거 찾기</div></div>
      <div class="route-card"><span class="route-num">03</span><span class="route-title">3차시 × 7문항</span><div class="route-desc">문제를 풀며 자원 특성·화석연료·재생에너지 입지를 차례로 정리합니다.</div><div class="route-mini">Q3. 자원 특징 판단<div class="bar"><i></i></div></div></div>
      <div class="route-card"><span class="route-num">04</span><span class="route-title">관심 + 이유</span><div class="route-desc">좋아 보이는 자원을 고르는 데서 끝나지 않고, ‘왜 적합한지’를 짧게 적어 판단 근거를 남깁니다.</div><div class="route-mini">💗 관심 표현<br>✍️ 선택 이유 작성</div></div>
      <div class="route-card"><span class="route-num">05</span><span class="route-title">지역 맞춤 최종 매칭</span><div class="route-desc">솔바람시의 자연·산업·환경 조건을 고려해 여러 자원을 조합하고 최종 판단을 설명합니다.</div><div class="route-mini">⚡ 에너지 믹스 = 100%<br>🌍 지역 조건과 연결</div></div>
    </div>
    <div class="route-actions"><a href="#l1">1차시 시작 ↓</a><a href="#l2">2차시 보기 ↓</a><a href="#l3">3차시 보기 ↓</a><a href="#final">최종 매칭 보기 ↓</a></div>`;
  if(visual) visual.insertAdjacentElement('afterend',guide); else concept.appendChild(guide);
}

function init(){
  addStyles();
  createTextbookModal();
  buildRouteGuide();
  decorateProfiles();
  decorateProfileModal();

  document.addEventListener('click',e=>{
    const img=e.target.closest?.('.source-card img');
    if(img){e.preventDefault();openTextbook(img);return;}
    if(e.target.closest?.('[data-theme]')||e.target.closest?.('[data-detail]')){
      setTimeout(()=>{decorateProfiles();decorateProfileModal();},0);
      setTimeout(()=>{decorateProfiles();decorateProfileModal();},80);
    }
  });

  const observer=new MutationObserver(()=>{decorateProfiles();decorateProfileModal();buildRouteGuide();});
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','src']});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();