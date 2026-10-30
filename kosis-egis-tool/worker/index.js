// Deploy separately. AUTH must validate the teacher session; Origin is not authentication.
const ALLOWED=['orgId','tblId','objL1','objL2','objL3','itmId','prdSe','startPrdDe','endPrdDe'];
export default {async fetch(request,env){
 const origin=request.headers.get('Origin')||'',headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(error,status)=>new Response(JSON.stringify({error}),{status,headers});
 if(!env.ALLOWED_ORIGIN||origin!==env.ALLOWED_ORIGIN)return reply('허용되지 않은 출처',403);
 headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Credentials']='true';
 if(new URL(request.url).pathname!=='/api/kosis')return reply('Not found',404);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Credentials':'true'}});
 if(request.method!=='GET')return reply('GET only',405);
 // Fail closed: teacher auth service and rate-limit binding are deployment prerequisites.
 if(!env.AUTH||!env.RATE_LIMITER||!env.KOSIS_API_KEY)return reply('교사 인증·호출 제한·서버 키 설정이 필요합니다.',503);
 try{
  const auth=await env.AUTH.fetch(new Request(request.url,{headers:request.headers,method:'GET'}));
  if(auth.status!==200)return reply('교사 인증이 필요합니다.',401);
  const identity=auth.headers.get('X-Teacher-Id');if(!identity)return reply('교사 인증이 필요합니다.',401);
  const limit=await env.RATE_LIMITER.limit({key:identity});if(!limit.success)return reply('조회가 많습니다. 잠시 후 다시 시도하세요.',429);
  const url=new URL(request.url),p=new URLSearchParams({method:'getList',apiKey:env.KOSIS_API_KEY,format:'json',jsonVD:'Y'});
  for(const key of url.searchParams.keys())if(!ALLOWED.includes(key))return reply('지원하지 않는 조회 조건',400);
  for(const k of ALLOWED){const v=url.searchParams.get(k);if(v){if(v.length>300||!/^[A-Za-z0-9_+.,\- ]+$/.test(v))return reply('조회 조건 형식 오류',400);p.set(k,v);}}
  for(const k of ['orgId','tblId','objL1','itmId','startPrdDe','endPrdDe'])if(!p.get(k))return reply(k+' 필수',400);
  if(!['Y','M','Q'].includes(p.get('prdSe')))return reply('수록주기 오류',400);
  for(const k of ['startPrdDe','endPrdDe'])if(!/^\d{4}(?:\d{2})?$/.test(p.get(k)))return reply('시점 형식 오류',400);
  const upstream=await fetch('https://kosis.kr/openapi/Param/statisticsParameterData.do?'+p,{signal:AbortSignal.timeout(15000)});
  if(!upstream.ok)return reply('KOSIS 응답 오류',502);
  const text=await upstream.text();if(text.length>10*1024*1024)return reply('응답이 너무 큽니다. 조회 범위를 줄이세요.',502);
  let data;try{data=JSON.parse(text);}catch{return reply('KOSIS JSON 형식 오류',502);}
  if(!Array.isArray(data))return reply('KOSIS 통계표·항목·시점 또는 인증 설정을 확인하세요.',502);
  headers['Access-Control-Allow-Credentials']='true';return new Response(JSON.stringify(data),{status:200,headers});
 }catch{return reply('인증 또는 KOSIS 조회 실패',502);}
}};
