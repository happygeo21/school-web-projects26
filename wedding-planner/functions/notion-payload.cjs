'use strict';
const rich = value => {
  const text=String(value||'');const parts=[];
  for(let i=0;i<text.length;i+=1900)parts.push({type:'text',text:{content:text.slice(i,i+1900)}});
  return parts;
};
function properties(record) {
  const category={'신혼집':'화정동 주택','촬영':'웨딩 촬영'}[record.category]||record.category;
  const status={'할 일':'확인 필요','진행 중':'문의 중','완료':'확정'}[record.status];
  if(!status)throw Error('Invalid status');
  return {
    '기록 제목':{title:rich(record.title)},'확인한 내용':{rich_text:rich(record.body)},
    '분야':{select:{name:category}},'상태':{status:{name:status}},'일자':{date:{start:record.date}}
  };
}
module.exports={properties};
