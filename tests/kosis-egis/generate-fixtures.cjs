// Synthetic teaching fixtures only; never official statistics or student data.
const fs=require('node:fs'),path=require('node:path'),C=require('../../kosis-egis-tool/core.js'),ref=require('../../kosis-egis-tool/reference.json');
const headers=['지역명','code','시도명','통계연도','연습값'];
const row=(r,i)=>[r.name,r.code,r.sido_name,'2025',i];
const cases={
 'synthetic-national-252':ref.map(row),
 'synthetic-jeonnam-22':ref.filter(r=>r.sido==='46').map(row),
 'synthetic-normal':[['전라남도 화순군','','','2025','1,234.5']],
 'synthetic-ambiguous':[['중구','','','2025',1],['고성군','','','2025',2]],
 'synthetic-missing-gu':[['수원시','','경기도','2025',100],['장안구','','경기도','2025',20]],
 'synthetic-errors':[['종로구','11140','서울특별시','2025',1],['화순군','','전라남도','2024',3],['화순군','','전라남도','2025','잘못된 값'],['목포시','','전라남도','2025','-']]
};
for(const [name,rows] of Object.entries(cases))fs.writeFileSync(path.join(__dirname,'fixtures',name+'.csv'),C.csv(rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]]))),headers));
