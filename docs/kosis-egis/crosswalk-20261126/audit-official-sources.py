"""Reproducible inventory, NOT an automatic approval/name-matching engine.
Usage: python audit-official-sources.py REPO ORIGINAL_CSV MOIS_TXT OUTPUT_DIR
"""
import csv, gzip, hashlib, json, sys
from collections import Counter
from pathlib import Path

repo, stat_file, mois_file, out = map(Path, sys.argv[1:5])
out.mkdir(parents=True, exist_ok=True)
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def save(name, value):
    (out/name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
with stat_file.open(encoding='cp949', newline='') as f:
    rows=list(csv.DictReader(f))
dates=Counter(r['개정일자'] for r in rows)
latest=max(dates)
snapshot=[r for r in rows if r['개정일자']==latest]
stats=[r for r in snapshot if len(r['행정동코드']) in (2,5)]
with mois_file.open(encoding='cp949',newline='') as f:
    legal=list(csv.DictReader(f,delimiter='\t'))
compact=lambda s: ''.join(s.split())
audit=[]; boundaries=[]
for level,ref_file,geo_file in [('sido','sido-reference.json','sido-2025.geojson'),('sgg','reference.json','sigungu-2025.geojson')]:
    refs=json.loads((repo/'kosis-egis-tool'/ref_file).read_text(encoding='utf-8'))
    geo=json.loads((repo/'kosis-egis-tool'/geo_file).read_text(encoding='utf-8'))
    props=[f['properties'] for f in geo['features']]
    for r in refs:
        hits=[p for p in props if p['code']==r['code']]
        fields=['code','name','base_year'] if level=='sido' else ['code','name','sido','sido_name','base_year']
        if len(hits)!=1 or any(str(hits[0].get(k,''))!=r[k] for k in fields):
            raise ValueError('Actual boundary/reference mismatch: '+r['code'])
        legal_hits=[v for v in legal if v['법정동코드']==r['code'].ljust(10,'0')]
        name=r['name'] if level=='sido' else r['sido_name']+' '+r['name']
        legal_identity=[v for v in legal_hits if compact(v['법정동명'])==compact(name)]
        province_codes={x['행정동코드'] for x in stats if len(x['행정동코드'])==2 and compact(x['행정동명'])==compact(r['sido_name'])}
        candidates=[x for x in stats if len(x['행정동코드'])==(2 if level=='sido' else 5) and compact(x['행정동명'])==compact(r['name']) and (level=='sido' or x['최상위행정동코드'] in province_codes)]
        audit.append({'target':r,'level':level,'boundaryIdentity':'exact','legalCodeRecords':legal_hits,'legalCodeNameIdentity':len(legal_identity)==1,'statisticalNameCandidates':candidates,'reviewState':'candidate-only','reason':'Name agreement is not official linkage or temporal compatibility evidence.'})
    boundaries.append({'level':level,'file':geo_file,'sha256':digest(repo/'kosis-egis-tool'/geo_file),'features':len(props),'referenceRows':len(refs),'allPropertiesEqual':True})
codes={r['target']['code']:r for r in audit}
collisions=[]
for r in stats:
    t=codes.get(r['행정동코드'])
    if t and compact(r['행정동명'])!=compact(t['target']['name']):
        collisions.append({'code':r['행정동코드'],'statisticalName':r['행정동명'],'boundaryName':t['target']['name']})
save('national-candidates.json',{'schemaVersion':1,'reviewState':'candidate-only','records':audit})
save('official-audit.json',{'statisticalFile':{'sha256':digest(stat_file),'encoding':'CP949','actualRows':len(rows),'portalDeclaredRows':569727,'declarationMismatch':len(rows)!=569727,'firstDate':min(dates),'lastDate':latest,'snapshotRows':len(snapshot),'snapshotCodeRows':len(stats),'dates':dates},'legalFile':{'sha256':digest(mois_file),'encoding':'CP949','actualRows':len(legal),'validityDatesPresent':False},'boundaries':boundaries,'targetCount':len(audit),'exactLegalCodeNameCount':sum(r['legalCodeNameIdentity'] for r in audit),'uniqueStatisticalNameCandidateCount':sum(len(r['statisticalNameCandidates'])==1 for r in audit),'numericCodeCollisions':collisions,'approvedMappings':0,'blockingEvidence':['KSSC period-specific linkage DB unavailable: TLS certificate name mismatch','No official historical geometry/administrative-change equivalence audit']})
save('statistical-snapshot.json',{'date':latest,'records':stats})
with gzip.GzipFile(filename='',mode='wb',fileobj=(out/'data-go-15136373-20250704.csv.gz').open('wb'),mtime=0) as g:
    g.write(stat_file.read_bytes())
print(json.dumps({'targets':len(audit),'exactLegalCodeNames':sum(r['legalCodeNameIdentity'] for r in audit),'uniqueNameCandidates':sum(len(r['statisticalNameCandidates'])==1 for r in audit),'actualRows':len(rows),'latest':latest,'approved':0}))
