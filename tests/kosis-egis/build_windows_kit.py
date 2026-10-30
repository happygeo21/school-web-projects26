"""Rebuild offline kit from the reviewed checkout. No network or installation."""
from pathlib import Path
import shutil,tempfile,json,hashlib,zipfile,sys
root=Path(__file__).resolve().parents[2]
source=Path(__file__).resolve().parent
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path(tempfile.mkdtemp(prefix='egis-kit-'))
out.mkdir(parents=True,exist_ok=True)
kit=out/'windows-kit'
if kit.exists():raise SystemExit('Use a new output directory; existing files are preserved.')
kit.mkdir()
for f in (source/'windows-kit').iterdir():
 if f.is_file():
  if f.suffix=='.cmd':(kit/f.name).write_bytes(f.read_text().replace('\n','\r\n').encode('ascii'))
  else:shutil.copy2(f,kit/f.name)
for f in ['core.js','reference.json']:shutil.copy2(root/'kosis-egis-tool'/f,kit/f)
shutil.copy2(source/'fixtures/egis-sigungu-2025.geojson',kit/'egis-sigungu.geojson')
shutil.copytree(source/'fixtures',kit/'fixtures')
for folder,files in {'kosis-egis':['index.html'],'kosis-egis-tool':['app.js','core.js','reference.json','conversion-worker.js','studio.css']}.items():
 dest=kit/'site'/folder;dest.mkdir(parents=True)
 for name in files:shutil.copy2(root/folder/name,dest/name)
js=source/'node_modules/xlsx/dist/xlsx.full.min.js'
if not js.exists():raise SystemExit('Run npm ci --ignore-scripts in tests/kosis-egis first, then rebuild in a new directory.')
shutil.copy2(js,kit/'site/kosis-egis-tool/xlsx.full.min.js');shutil.copy2(js.parent.parent/'LICENSE',kit/'SheetJS-LICENSE.txt')
p=kit/'site/kosis-egis/index.html';p.write_text(p.read_text().replace('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','../kosis-egis-tool/xlsx.full.min.js'))
shutil.copy2(root/'docs/kosis-egis/windows-guide.md',kit/'WINDOWS-START-HERE.md');shutil.copy2(root/'docs/kosis-egis/classroom-checklist.md',kit/'PR8-CHECKLIST.md')
(kit/'README.md').write_text('Start with WINDOWS-START-HERE.md. Node.js 22+ required. No Python or npm install is needed on the teacher PC.\n')
manifest={str(p.relative_to(kit)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in kit.rglob('*') if p.is_file()}
(kit/'sha256-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
zpath=out/'egis-windows-validation-kit.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED) as z:
 for p in kit.rglob('*'):
  if p.is_file():z.write(p,'windows-kit/'+str(p.relative_to(kit)))
with zipfile.ZipFile(zpath) as z:
 assert z.testzip() is None
 for name,sha in manifest.items():assert hashlib.sha256(z.read('windows-kit/'+name)).hexdigest()==sha
sha=hashlib.sha256(zpath.read_bytes()).hexdigest();zpath.with_suffix('.zip.sha256').write_text(sha+'  '+zpath.name+'\n')
print(json.dumps({'zip':str(zpath),'sha256':sha,'files':len(manifest)},indent=2))
