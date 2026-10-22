const MAX=5_000_000,types={jpg:'사진',jpeg:'사진',png:'사진',webp:'사진',pdf:'PDF',txt:'텍스트',csv:'표',doc:'Word',docx:'Word',xls:'Excel',xlsx:'Excel',ppt:'PowerPoint',pptx:'PowerPoint'};
const errors={'invalid-file':'파일 내용·형식·크기를 확인해 주세요. 지원하는 파일만 5MB 이하로 올릴 수 있어요.','attachment-rejected':'노션이 파일을 받지 못했어요. 연결·파일 형식과 노션 권한을 확인한 뒤 다시 저장해 주세요.','check-notion-attachment':'파일 반영 결과가 불확실해 중복 업로드를 막았어요. 노션에서 먼저 확인해 주세요.','attachment-count-limit':'이 기록의 첨부 한도 20개에 도달했어요. 새 기록으로 나눠 주세요.','attachment-daily-limit':'오늘의 첨부 한도(두 사람 합계 40회)에 도달했어요. 한국 시간 오전 9시 이후 다시 시도해 주세요.','attachment-read-limit':'오늘의 파일 열기 한도(500회)에 도달했어요. 노션에서 직접 확인하거나 오전 9시 이후 다시 열어 주세요.','attachment-slow-down':'파일을 연속으로 올리고 있어요. 잠시 후 다시 저장해 주세요.','send-record-first':'파일을 올리기 전에 기록을 노션에 반영해야 해요.','record-changed':'다른 화면에서 기록이 바뀌었어요. 최신 기록을 다시 열어 주세요.','access-denied':'첨부 접근 권한을 확인하지 못했어요. 다시 로그인해 주세요.','attachment-not-found':'파일이 노션에서 이동되었거나 삭제됐어요. 노션 기록을 확인해 주세요.','daily-limit':'오늘의 노션 기록 전송 한도에 도달했어요. 공동 기록은 저장됐고, 첨부는 오전 9시 이후 다시 시도해 주세요.','slow-down':'다른 노션 전송이 진행됐어요. 6초 후 다시 저장해 주세요.'};
export function createAttachments({endpoint,session,message}){
 const $=id=>document.getElementById(id),base=new URL(endpoint).origin;
 let pending=[],busy=false;const urls=new Set(),controllers=new Set();
 const current=()=>{const s=session();if(!s.allowed||!s.user)throw Error('로그인 후 파일을 이용할 수 있어요.');return s;};
 const alive=epoch=>session().allowed&&session().generation===epoch;
 function paint(){ $('pendingFiles').replaceChildren(...pending.map(p=>{const row=document.createElement('div');row.className='pending-file';const text=document.createElement('span');text.textContent=`${p.file.name} · ${(p.file.size/1e6).toFixed(2)}MB${p.optimized?' · 사진 사본':''}`;const remove=document.createElement('button');remove.type='button';remove.textContent='선택 취소';remove.disabled=busy;remove.onclick=()=>{pending=pending.filter(x=>x!==p);paint();};row.append(text,remove);return row;}));$('save').textContent=pending.length?'기록 저장 · 파일 올리기':'둘이 함께 저장';$('fileInput').disabled=busy||!session().allowed;}
 async function request(path,r,{file,opId}={}){const s=current(),controller=new AbortController();controllers.add(controller);
  try{const token=await s.user.getIdToken();if(!alive(s.generation))throw Error('로그아웃했습니다.');const headers={Authorization:`Bearer ${token}`,'X-Record-Id':r.id,'X-Record-Revision':String(r.revision)};
   if(opId)headers['X-Attachment-Id']=opId;if(file){headers['Content-Type']=file.type||'application/octet-stream';headers['X-File-Name']=encodeURIComponent(file.name);}
   const timeout=setTimeout(()=>controller.abort(),35000);let response;try{response=await fetch(base+'/attachments/'+path,{method:'POST',headers,body:file||undefined,signal:controller.signal});}finally{clearTimeout(timeout);}
   if(!alive(s.generation))throw Error('로그아웃했습니다.');if(!response.ok){const result=await response.json();throw Error(errors[result.code]||'파일을 열지 못했어요. 잠시 후 다시 시도하거나 노션 원본에서 확인해 주세요.');}return response;
  }finally{controllers.delete(controller);}
 }
 $('fileInput').onchange=async()=>{const s=current(),chosen=[...$('fileInput').files];$('fileInput').value='';if(chosen.length+pending.length>3){message('한 번에 파일 3개까지 선택할 수 있어요.',true);return;}busy=true;paint();
  try{const next=[];for(const file of chosen){const ext=file.name.split('.').pop().toLowerCase();if(!types[ext]||!file.size||file.size>MAX)throw Error('사진(JPG·PNG·WEBP), PDF·Word·Excel·PowerPoint·TXT·CSV를 파일당 5MB 이하로 선택해 주세요. 한글 문서는 PDF로 저장해 주세요.');
    let ready=file,optimized=false;
    if(['jpg','jpeg','png','webp'].includes(ext)){const image=await createImageBitmap(file,{imageOrientation:'from-image'});try{if(image.width*image.height>40e6)throw Error('사진 해상도가 너무 커요. 크기를 줄여 주세요.');const scale=Math.min(1,2048/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const mime=ext==='png'?'image/png':'image/jpeg',blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,.86));if(!blob||blob.size>MAX)throw Error('사진 크기를 더 줄여 주세요.');ready=new File([blob],file.name.replace(/\.[^.]+$/,mime==='image/png'?'.png':'.jpg'),{type:mime});optimized=true;}finally{image.close();}}
    next.push({file:ready,opId:crypto.randomUUID(),optimized});
   }if(alive(s.generation)){pending.push(...next);message('파일을 선택했어요. 저장을 누르기 전에는 전송되지 않습니다.');}
  }catch(e){if(alive(s.generation))message(e.message,true);}finally{busy=false;paint();}
 };
 async function show(r,container){const epoch=current().generation;container.replaceChildren(document.createTextNode('첨부 확인 중…'));
  try{const result=await (await request('list',r)).json();if(!alive(epoch))return;container.replaceChildren();
   if(!result.files.length)container.append(document.createTextNode('아직 첨부가 없어요. 기록 수정하기에서 파일을 추가하세요.'));
   if(result.pageId){const a=document.createElement('a');a.href='https://www.notion.so/'+result.pageId.replaceAll('-','');a.target='_blank';a.rel='noopener noreferrer';a.textContent='노션 원본 열기 ↗';container.append(a);}
   for(const file of result.files){const row=document.createElement('div');row.className='attachment-row';const label=document.createElement('p');label.textContent=`${file.name} · ${(file.size/1e6).toFixed(2)}MB`;const download=document.createElement('button');download.type='button';download.textContent='파일 내려받기';
    async function load(preview){download.disabled=true;try{const response=await request('download',r,{opId:file.id}),blob=await response.blob();if(!alive(epoch))return;const url=URL.createObjectURL(blob);urls.add(url);
      if(preview){const img=document.createElement('img');img.className='attachment-photo';img.alt=file.name;img.src=url;row.append(img);message('사진을 열었어요.');}else{const a=document.createElement('a');a.href=url;a.download=file.name;a.click();message('파일 내려받기를 시작했어요.');setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},30000);}
     }catch(e){if(alive(epoch))message(e.message,true);}finally{download.disabled=false;}}
    download.onclick=()=>load(false);row.append(label,download);if(file.mime.startsWith('image/')){const preview=document.createElement('button');preview.type='button';preview.textContent='사진 보기';preview.onclick=async()=>{const shown=row.querySelector('img');if(shown){URL.revokeObjectURL(shown.src);urls.delete(shown.src);shown.remove();preview.textContent='사진 보기';return;}preview.disabled=true;await load(true);preview.textContent=row.querySelector('img')?'사진 닫기':'사진 보기';preview.disabled=false;};row.append(preview);}container.append(row);
   }
  }catch(e){if(alive(epoch))container.textContent=e.message;}
 }
 return {
  hasPending:()=>pending.length>0,
  isBusy:()=>busy,
  clearPending(){pending=[];$('fileInput').value='';$('existingFiles').replaceChildren();paint();},
  clearPrivate(){for(const c of controllers)c.abort();for(const url of urls)URL.revokeObjectURL(url);urls.clear();pending=[];busy=false;$('existingFiles').replaceChildren();paint();},
  setBusy(value){busy=value;paint();},
  refresh:paint,
  showExisting(r){show(r,$('existingFiles'));},
  addCard(r,el){const panel=document.createElement('div');panel.className='attachment-list';panel.hidden=true;const b=document.createElement('button');b.type='button';b.textContent='사진·첨부파일 보기';b.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden)show(r,panel);};el.append(b,panel);},
  async uploadPending(r){if(!pending.length)return;const s=current();message('기록은 공동 저장됐어요. 노션에 기록과 파일을 보관하는 중…');
   const token=await s.user.getIdToken();if(!alive(s.generation))throw Error('로그아웃했습니다.');const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(r),signal:AbortSignal.timeout(30000)});const result=await response.json();if(!response.ok)throw Error(errors[result.code]||'노션 기록 반영에 실패했어요. 잠시 후 다시 저장해 주세요.');
   let uploaded=0;for(const p of [...pending]){if(uploaded)await new Promise(resolve=>setTimeout(resolve,1600));if(!alive(s.generation))throw Error('로그아웃했습니다.');message(`기록 저장 완료 · ${p.file.name} 올리는 중…`);await request('upload',r,{file:p.file,opId:p.opId});if(!alive(s.generation))return;pending=pending.filter(x=>x!==p);uploaded++;paint();}
  }
 };
}
