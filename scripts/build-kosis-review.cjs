/* A separate, allowlisted offline review package. Never a Pages deployment. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),output=process.argv[2];if(!output)throw Error('Pass a NEW output directory');
const dest=path.resolve(output);if(fs.existsSync(dest))throw Error('Output already exists; choose a new directory');
const sha=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const dirty=!!cp.execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
if(dirty&&!process.argv.includes('--working'))throw Error('Commit changes before creating an exact-commit package');
const allowed=require('./public-files.json').files.filter(p=>/^(kosis-egis\/|kosis-egis-tool\/|egis-student-guide\/)/.test(p)&&!p.includes('/legacy/'));
const hashes={};
for(const name of allowed){
 if(path.posix.normalize(name)!==name||name.includes('\\')||/(?:test|fixture|original|private|\.xlsx|\.egis)/i.test(name))throw Error('Review input or unsafe path in runtime package: '+name);
 let checked=root;for(const part of name.split('/')){checked=path.join(checked,part);if(fs.lstatSync(checked).isSymbolicLink())throw Error('Symlink not allowed: '+name);}
 const bytes=fs.readFileSync(path.join(root,name));if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_|github_pat_|ntn_)[A-Za-z0-9_]{25,}/.test(bytes.toString('utf8')))throw Error('Credential pattern: '+name);
 hashes[name]=crypto.createHash('sha256').update(bytes).digest('hex');const file=path.join(dest,'site',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
}
fs.copyFileSync(path.join(root,'tests/kosis-egis/windows-kit/start-local.cjs'),path.join(dest,'start-local.cjs'));
fs.writeFileSync(path.join(dest,'START-WINDOWS.cmd'),'@echo off\r\ncd /d "%~dp0"\r\nnode start-local.cjs\r\npause\r\n');
const launchers=Object.fromEntries(['start-local.cjs','START-WINDOWS.cmd'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(dest,f))).digest('hex')]));
fs.writeFileSync(path.join(dest,'CANDIDATE.json'),JSON.stringify({repository:'happygeo21/school-web-projects26',pr:29,commit:sha,uncommitted:dirty,builtAt:new Date().toISOString(),deployment:false,files:hashes,launchers},null,2)+'\n');
fs.writeFileSync(path.join(dest,'README.txt'),'PR #29 독립 검증판 (운영 GitHub Pages 아님)\n커밋: '+sha+(dirty?' + 미커밋 작업본':'')+'\n\n1. ZIP을 새 폴더에 모두 풀어요.\n2. Node.js가 있는 PC에서 START-WINDOWS.cmd를 실행해요. Mac/Linux는 node start-local.cjs\n3. http://127.0.0.1:8000/kosis-egis/ 를 브라우저로 열어요.\n4. 직접 받은 원본 XLSX를 선택해요. 고정 QA ZIP의 inputs/A와 inputs/B, 기존 INH 원본을 각각 시험해요.\n5. CSV와 실제 경계를 받아 https://www.e-gis.kr/ 에서 결합해요.\n6. 끝나면 실행 창에서 Ctrl+C로 종료해요.\n\n원본 통계 검토 파일, QA ZIP, 개인 기록, 토큰은 이 실행판에 포함하지 않았어요.\n외부 서버 설치나 운영 배포 없이 127.0.0.1에서 정적 파일만 제공해요. 변환은 브라우저 안에서 실행해요. KOSIS 검색과 실제 e-GIS 이용에는 인터넷이 필요해요.\nCANDIDATE.json에서 정확한 커밋과 모든 실행 파일 SHA256을 확인할 수 있어요.\n');
console.log(JSON.stringify({output:dest,commit:sha,uncommitted:dirty,publicFiles:allowed.length}));
fs.appendFileSync(path.join(dest,'README.txt'),'\n기존 INH 원본(별도 다운로드): https://github.com/happygeo21/school-web-projects26/blob/'+sha+'/tests/kosis-egis/fixtures/crosswalk-20261126/fertility-2024.xlsx\n고정 10종은 공용 칠판의 기존 Codex-QA-20261126.zip을 재사용합니다. ZIP의 원본을 직접 고르고 엑셀에서 편집하지 마세요.\n지원/차단 및 실제 지도 근거: https://github.com/happygeo21/school-web-projects26/blob/'+sha+'/docs/kosis-egis/pr29-student-validation-20261126/README.md\n');
