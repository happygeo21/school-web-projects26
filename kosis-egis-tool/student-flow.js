/* Presentation only: reuses the existing file reader, worker, validation and exports. */
'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const $=id=>document.getElementById(id),stepNames=['지역 선택','자료 입력','자동 변환 및 결과 확인','e-GIS 지도 제작'];
 let mode='easy',step=0,visited=1,route='',needsPractice=false,downloaded=false,guideStep=0;
 let state={ready:false,busy:false,hasData:false,canExport:false,status:'',rows:0,metrics:[],preview:[],issues:[]};
 const steps=[...document.querySelectorAll('[data-flow-step]')];
 ['sourceProfile','name','code','sido','year','tableTitle'].forEach(id=>$(id).closest('label').classList.add('expert-field'));
 const practice=document.createElement('p');practice.id='practiceReady';practice.className='notice';$('upload').querySelector('h2').after(practice);
 function change(id,value){$(id).value=value;$(id).dispatchEvent(new Event('change',{bubbles:true}));}
 function focusStep(){const el=$('flowHeading');el.focus({preventScroll:true});$('flowWizard').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 function setStep(n){if(n===3&&!state.hasData)return;if(n===4&&!state.canExport)return;step=n;visited=Math.max(visited,n);render();if(n)focusStep();}
 function show(next){mode=next;if(mode==='easy'){if(!step&&state.hasData){step=3;visited=3;route=state.synthetic?'practice':'file';}if(step===4&&!state.canExport)step=state.hasData?3:2;}document.body.dataset.view=mode;$('modeEasy').setAttribute('aria-pressed',String(mode==='easy'));$('modeDetailed').setAttribute('aria-pressed',String(mode==='detailed'));$('viewSwitch').dataset.currentMode=mode;render();}
 function choose(kind){if(!state.ready)return;const different=route!==kind;route=kind;document.body.dataset.route=route;needsPractice=kind!=='file'&&(different||!state.hasData);if(different||!state.hasData){change('analysisMode',kind==='jeonnam'?'regional':kind==='sido'?'sido':'auto');change('scope',kind==='jeonnam'?'46':'all');}visited=1;setStep(1);}
 function review(){
  const box=$('easyDetected');box.replaceChildren();
  const labels={sido:'시도별',sgg:'시군구별',city:'상위 시·군별',unknown:'직접 확인 필요'};
  for(const [title,value] of [['지역',labels[state.unit]||'확인 필요'],['분석 범위',state.scopeLabel||'확인 필요'],['지역명 열',state.regionColumn||'선택되지 않음'],['통계값 열',state.metrics.join(' · ')||'선택되지 않음'],['자료연도',state.period||'입력 필요'],['입력 자료',state.rows+'행'+(state.synthetic?' · 합성 연습자료':'')]]){const p=document.createElement('p'),b=document.createElement('b'),s=document.createElement('span');b.textContent=title;s.textContent=value;p.append(b,s);box.append(p);}
  const preview=$('easySample');preview.replaceChildren();if(state.hasData){const t=document.createElement('table');const row=(cells,head)=>{const tr=document.createElement('tr');for(const text of cells){const td=document.createElement(head?'th':'td');td.textContent=text;tr.append(td);}t.append(tr);};row([state.regionColumn||'지역명',...state.metrics],true);state.preview.forEach(r=>row(r,false));preview.append(t);}
 }
 function render(){
  document.body.dataset.flowStep=String(step);document.body.dataset.route=route;
  const locked=mode==='easy'&&['jeonnam','sido'].includes(route);$('analysisMode').disabled=locked;$('scope').disabled=locked;
  ['startJeonnam','startSido','startFile'].forEach(id=>$(id).disabled=!state.ready||state.busy);
  $('startStatus').textContent=state.ready?'파일은 이 브라우저에서만 처리해요.':state.error?'기준표를 준비하지 못했어요. 연결을 확인한 뒤 새로고침해 주세요.':'지역 기준표를 준비하고 있어요…';
  $('flowPosition').textContent=step+' / 4 단계';$('flowHeading').textContent=stepNames[Math.max(0,step-1)];$('flowProgress').value=step||1;
  const briefs=[state.scopeLabel||'지역 고르기',state.hasData?(state.synthetic?'연습자료':state.title)+' · '+state.rows+'행':'파일 넣기',state.status||'지역과 숫자 확인','같은 단위의 지도에 연결'];
  steps.forEach((b,i)=>{const n=i+1;b.disabled=n>visited||state.busy||(n===3&&!state.hasData)||(n===4&&!state.canExport);if(n===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');b.querySelector('.step-brief').textContent=n<step?briefs[i]:'';});
  practice.hidden=route==='file';practice.textContent=state.hasData?'연습자료 '+state.rows+'개를 준비했어요. 가상 수치이며 실제 통계가 아니에요.':'연습자료를 준비하고 있어요…';
  const hints={1:locked?'선택한 연습자료와 같은 지역이에요. 확인하고 다음으로 가세요.':'자료의 지역을 모르면 자동 추천을 선택하세요. 파일을 읽은 뒤 다시 확인할 수 있어요.',2:state.busy?'파일을 읽고 있어요…':state.hasData?'자료가 준비됐어요. 다음에서 지역·통계값·연도를 확인해요.':'엑셀이나 CSV 파일을 넣으세요. 시트가 여러 개면 자료가 담긴 시트를 골라요.',3:state.busy?'지역과 숫자를 확인하고 있어요…':state.status==='결합 중단'?'고쳐야 할 문제가 있어요. 아래 문제와 해결 방법을 확인하세요.':state.canExport?'변환 결과를 확인한 뒤 CSV를 받고 지도 만들기로 가세요.':'자동으로 읽은 내용과 미리보기를 확인하고 지역 단위 확인에 체크하세요.',4:'같은 지역 단위의 경계에 CSV를 연결하세요. 안내를 눌러 한 단계씩 따라 해요.'};
  $('flowHint').textContent=state.error?'파일을 읽거나 변환하지 못했어요. '+state.error+' 상세 모드에서 시트와 열을 확인할 수 있어요.':hints[step]||'';
  $('flowPrev').disabled=state.busy;$('flowPrev').textContent=step===1?'처음 선택으로':'이전 단계';
  let next='다음 단계';if(step===1)next='② 자료 입력으로';if(step===2)next='③ 자동 분석 확인하기';if(step===3)next=state.status==='결합 중단'?'상세 모드에서 문제 고치기':state.canExport?(downloaded?'④ 지도 만들기로':'CSV 받고 ④ 지도 만들기'):'확인한 내용으로 변환하기';if(step===4)next='CSV 다시 받기';
  $('flowNext').textContent=next;$('flowNext').disabled=!state.ready||state.busy||(step===2&&!state.hasData)||(step===4&&!state.canExport);
  $('flowActions').hidden=mode!=='easy'||!step;
  const blocked=state.status==='결합 중단',warning=state.status==='확인 필요';
  $('easyFeedback').textContent=blocked?'잘못 연결된 지역이나 통계값이 있어 CSV를 만들지 않았어요. 상세 모드에서 지역·코드·시트·통계 열을 확인하고 다시 변환하세요.':warning?'누락·빈칸·연도 차이 등 확인할 내용이 있어요. 아래 안내와 원본을 확인하세요. 빈칸은 0으로 바꾸지 않아요.':state.canExport?'변환이 끝났어요. CSV를 받아 e-GIS에서 지도와 연결하세요.':'';
  $('easyFeedback').className=blocked||warning?'notice':'success-note';$('easyFeedback').hidden=!state.status;$('fixDetailed').hidden=!blocked&&!warning;
  $('csv').classList.add('primary');
  const regionColumns=['name','code','sido','year'].map(id=>+$(id).value);
  document.querySelectorAll('#metrics label').forEach(label=>{const cb=label.querySelector('input');label.dataset.regionField=String(!cb.checked&&regionColumns.includes(+cb.value));});
  [...$('summary').children].forEach(p=>{const label=p.textContent.split(' : ')[0],value=p.textContent.split(' : ')[1];p.dataset.easyOptional=String(['입력 행','분석 범위'].includes(label)||(['합계행','범위 밖'].includes(label)&&value==='0'));});
  $('issues').classList.toggle('no-issues',!state.issues.length);const issueTitle=$('issues').previousElementSibling?.previousElementSibling;if(issueTitle?.tagName==='H3'){issueTitle.classList.toggle('no-issues',!state.issues.length);issueTitle.nextElementSibling.classList.toggle('no-issues',!state.issues.length);}
  const nameHead=$('preview').querySelector('tr')?.children[1];if(nameHead)nameHead.textContent=mode==='easy'?'지역명':'name';
  review();renderGuide();
 }
 const guide=[
  ['e-GIS 열기','위의 ‘e-GIS 열기’를 눌러 실제 서비스를 새 창에서 열어요. 이 안내와 e-GIS 화면을 번갈아 보세요.','지금부터는 e-GIS에서 직접 확인해요. 변환 완료만으로 지도 결합이 끝난 것은 아니에요.'],
  ['같은 지역의 경계 불러오기',()=>state.targetUnit==='sido'?'시도별 자료에는 시도 경계를 불러와요. 내장 경계는 2025년 기준 전국17개예요.':'시군구 자료에는 시군구 경계를 불러와요. 전남 자료라면 전남22개 시군을 선택해요. 전국 내장 경계는 2025년 기준252개예요.','아래 실제 경계 받기를 이용할 수 있어요. 자료연도와 지도 기준연도가 다르면 행정구역 변경도 확인하세요.'],
  ['CSV 표 불러오기·테이블 결합','받은 CSV를 자료/테이블 불러오기에서 선택하고, 지도 레이어의 테이블 결합 기능을 찾아요. 메뉴 이름은 서비스 화면에 따라 달라질 수 있어요.','한글이 깨지면 UTF-8로 읽으세요. 지역 code는 문자, 통계값은 숫자로 읽혀야 해요.'],
  ['지도와 CSV의 code 연결',()=>state.targetUnit==='sido'?'지도 쪽 code와 CSV 쪽 code를 연결해요. 시도 코드는 문자열2자리예요.':'지도 쪽 code와 CSV 쪽 code를 연결해요. 시군구 코드는 문자열5자리예요.','실제 속성 열 이름과 값을 먼저 확인하세요. 코드 연결 수와 숫자가 있는 지역 수를 따로 확인해요.'],
  ['단계구분도 만들기',()=> '주제도/단계구분도에서 통계 숫자 열'+(state.metrics.length?' (‘'+state.metrics.join(' · ')+'’)':'')+'을 선택해요. 값에 따라 지역의 색을 나누어요.','code나 base_year를 지표로 선택하지 마세요. 비율과 인원수는 다른 뜻이에요.'],
  ['범례·결측값·자료연도 확인','범례의 구간·단위와 빈값의 색을 확인해요. 표본 지역의 값이 원본과 같은지 살펴보고 자료연도와 경계연도를 적어요.','빈칸은 0이 아니에요. 결합되지 않은 지역·누락·결측을 숨기지 마세요.'],
  ['지도 내보내기','e-GIS의 지도 이미지 내보내기 기능을 찾아 저장해요. 제목·범례·단위·출처·자료연도가 결과에 보이도록 확인해요.','위의 학생 시범 지도2종과 비교해 보세요. 연습값으로 만든 지도는 합성자료 연습이라고 표시해요.']
 ];
 function renderGuide(){if(!guide)return;const g=guide[guideStep];$('mapGuidePosition').textContent=(guideStep+1)+' / 7 안내';$('mapGuideTitle').textContent=g[0];$('mapGuideText').textContent=typeof g[1]==='function'?g[1]():g[1];$('mapGuideCheck').textContent=g[2];[...$('mapGuideSteps').querySelectorAll('button')].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===guideStep)));$('mapGuidePrev').disabled=guideStep===0;$('mapGuideNext').disabled=guideStep===6;}
 guide.forEach((g,i)=>{const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=(i+1)+'. '+g[0];b.onclick=()=>{guideStep=i;renderGuide();};li.append(b);$('mapGuideSteps').append(li);});
 $('mapGuidePrev').onclick=()=>{guideStep=Math.max(0,guideStep-1);renderGuide();};$('mapGuideNext').onclick=()=>{guideStep=Math.min(6,guideStep+1);renderGuide();};
 $('modeEasy').onclick=()=>show('easy');$('modeDetailed').onclick=()=>show('detailed');$('reviewDetailed').onclick=()=>{show('detailed');$('name').focus();};$('fixDetailed').onclick=()=>{show('detailed');$('issues').scrollIntoView({block:'center'});};
 $('startJeonnam').onclick=()=>choose('jeonnam');$('startSido').onclick=()=>choose('sido');$('startFile').onclick=()=>choose('file');
 steps.forEach(b=>b.onclick=()=>setStep(+b.dataset.flowStep));
 $('flowPrev').onclick=()=>setStep(Math.max(0,step-1));
 $('flowNext').onclick=()=>{
  if(step===1){setStep(2);if(needsPractice){needsPractice=false;$(route==='sido'?'demoSido':'demo').click();}return;}
  if(step===2)return setStep(3);
  if(step===3){if(state.status==='결합 중단')return $('fixDetailed').click();if(state.canExport){if(!downloaded)$('csv').click();return setStep(4);}if(!$('confirmUnit').checked){$('flowHint').textContent='원본과 같은 지역 단위인지 확인하고 체크해 주세요.';$('confirmUnit').focus();return;}if(!['sido','sgg'].includes($('sourceUnit').value)){$('flowHint').textContent='아직 지역 단위를 확정하기 어려워요. 상세 모드에서 지역명·시도·코드 열을 확인하세요.';return;}if(!/^\d{4}$/.test($('period').value)){$('flowHint').textContent='자료 기준연도를 네 자리로 입력해 주세요.';$('period').focus();return;}if(!document.querySelector('#metrics input:checked')){$('flowHint').textContent='지도에 나타낼 통계값 열을 하나 이상 선택해 주세요.';return;}$('convert').click();return;}
  if(step===4)$('csv').click();
 };
 $('csv').addEventListener('click',()=>{if(state.canExport){downloaded=true;render();}});
 document.addEventListener('kosis:state',e=>{
  state=e.detail;if(['changed','loading','analyzed','running','error'].includes(state.phase))downloaded=false;
  if(state.phase==='loading'){route='file';needsPractice=false;}
  if(state.phase==='analyzed'&&mode==='easy'&&$('analysisMode').value==='auto'&&['sido','sgg'].includes(state.unit))$('useRecommended').click();
  if(mode==='easy'&&step===4&&!state.canExport)step=state.hasData?3:2;
  render();if(state.phase==='converted'&&mode==='easy'&&step===3)$('result').scrollIntoView({block:'start',behavior:'smooth'});
 });
 show(new URLSearchParams(location.search).get('view')==='detailed'?'detailed':'easy');
 document.dispatchEvent(new Event('kosis:request-state'));
});
