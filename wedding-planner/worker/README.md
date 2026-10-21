# 무료 노션 전송 서버

Firebase Spark 공동 저장 + Cloudflare Workers Free + SQLite Durable Object를 사용합니다. Google 결제 계정, Blaze, Cloud Functions, Secret Manager, 서비스 계정 키는 사용하지 않습니다.

## 사용

공동 기록에서 **노션에 보내기**를 누르면 현재 저장된 버전을 Wedding Journal DB에 반영합니다. 제목·내용·기록일·분야·상태·관련 금액(원)·금액 구분·다음 행동·예정일을 보냅니다. 노션 수정은 Firebase로 역전송되지 않습니다. 모든 기록의 무조건 자동 복사는 하지 않습니다.

금액 구분은 미분류·예상·견적·계약금액·실제지출입니다. 금액 미정의 기존 0원을 실제 지출로 추정하지 않으며 견적과 계약금액·예약금·잔금을 합산하지 않습니다. 기존 Notion 분야 이름과 Firestore category 값은 보존하고 웹 화면만 가족 식사·웨딩스냅·신혼집 구매로 안내합니다.

### 기존 전송 기록의 금액 보완

`MAPPING_VERSION=2`를 전송 메타데이터에 저장합니다. 이전 버전에서 이미 보낸 revision도 새 매핑으로 한 번 PATCH하여 금액을 추가하며 기존 pageId를 유지합니다. 새 매핑까지 반영한 같은 revision은 재전송하지 않습니다. 기존 기록에 없는 nextAction/dueDate는 기존 노션 값을 덮어쓰지 않고, 새 양식에서 명시적으로 입력·비운 값만 반영합니다. 불확실 상태는 버전이 바뀌어도 자동 해제하지 않습니다.

## 비용 제한

- Cloudflare **Workers Free 유지**, 유료 전환·결제 등록 없음. 기존 다른 Worker와 계정의 무료 한도를 공유합니다.
- Workers Free 일일 요청 100,000회 한도. Durable Objects Free도 별도 요청·연산·저장 한도가 있으며 한도 초과 시 실패합니다. 무료 한도는 무제한 가용성을 뜻하지 않습니다.
- 앱 자체 제한: 두 사람 합계 하루 **200회 실제 노션 전송 시도**, 전체 **6초 간격**. UTC 자정(한국 오전 9시) 초기화. 같은 버전 재확인은 노션을 호출하지 않습니다.
- Firebase **Spark 유지**. 무료 한도 도달 시 사용을 중단하고 초기화/데이터 정리 후 재개합니다. 유료 요금제로 자동 전환하는 코드는 없습니다.
- 무한 재시도·백그라운드 반복 전송·유료 서비스 우회 연결 없음. 한도 오류는 사용자가 확인할 수 있도록 표시합니다.
- 만약 사람이 추후 계정을 유료로 바꾸면 공급자 한도와 과금 정책이 달라집니다. 요금제 유지가 비용 방지의 기본 조건입니다.

공식: [Workers 가격](https://developers.cloudflare.com/workers/platform/pricing/), [Durable Objects 가격](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Firebase 무료 한도](https://firebase.google.com/docs/firestore/quotas).

## 보안

1. 브라우저는 기록 본문 대신 기록 ID/revision과 현재 Firebase ID 토큰을 HTTPS로 전달합니다.
2. 서버는 이 토큰으로 Firestore REST를 읽습니다. 기존 Rules가 같은 프로젝트의 Google 로그인·인증 이메일·비공개 두 계정 허용 목록을 검사합니다. 권한을 우회하는 관리자 키는 없습니다.
3. 서버가 읽은 원본만 전송합니다. 클라이언트가 바꾼 제목·내용을 믿지 않습니다. 현재 revision이 달라지면 거부합니다.
4. 공개 Origin은 happygeo21.github.io로 제한합니다. Origin 검사는 보조 방어이며 실제 권한 경계는 Firestore Rules입니다.
5. Notion 토큰은 전용 Worker의 **Secret** `WEDDING_NOTION_TOKEN`에만 암호화해 보관합니다. `.dev.vars`, `.env`, OAuth 로그인 파일, 토큰 출력은 공개 배포에 넣지 않습니다.
6. Durable Object에는 노션 page ID·revision·상태·횟수·전송 매핑 버전만 저장합니다. 이메일·토큰·기록 본문은 저장하지 않습니다. Workers 로그와 추적은 비활성입니다. Cloudflare는 전송 처리자로 선택한 기록 및 일시적 로그인 인증값을 처리합니다.
7. 같은 버전은 중복 생성하지 않고 수정 버전은 같은 노션 페이지를 PATCH합니다. 네트워크/5xx/응답 해석 실패는 `uncertain`으로 잠가 자동 재시도를 차단합니다. 관리자 확인 없이 잠금을 해제하지 않습니다.

## 배포

`pnpm install --frozen-lockfile` → `pnpm test` → 공식 `wrangler login` → `pnpm deploy`.

권한은 account:read, user:read, workers_scripts:write만 사용합니다(로그인 유지 권한은 공식 OAuth 필수). 배포 대상은 `wedding-notion-private-sync`로 한정합니다. 기존 학교용 Worker를 수정하지 않습니다.

Cloudflare 설정에서 런타임 변수 및 시크릿 → 변수 추가 → 이름 `WEDDING_NOTION_TOKEN` → **비밀 선택** → 전용 노션 토큰 입력 → 프로덕션 배포. 토큰 원문을 명령줄 인수, 채팅, 문서, GitHub에 입력하지 않습니다.

SQLite DO 클래스/마이그레이션과 이름 `private-wedding-journal-v1`은 운영 상태를 보존하기 위해 유지합니다. 이름을 바꾸면 중복 방지 이력이 분리되므로 임의로 바꾸지 않습니다. 새 토큰 배포 시 기존 DO 상태를 삭제하지 않습니다.

## 전송 복구

`check-notion`이면 노션 DB를 직접 조회해 실제 생성/수정 결과를 먼저 확인합니다. 관리자는 해당 기록의 Durable Object 저장값 `record:<Firebase ID>`를 확인하고 올바른 pageId/revision/state를 연결한 뒤 재개합니다. 생성 여부가 불확실한 상태에서 state를 삭제하거나 새 서버 이름으로 재배포하면 중복이 생길 수 있습니다. 현재 공개 복구 API는 제공하지 않습니다.

## 검증 구분

`node --test`: 인증 실패 시 전송 차단, 동시 중복/수정 갱신, stale revision, 불확실 응답의 재시도 차단, 일일 제한/초기화, 오류의 성공 오표시 방지, CORS, 긴 Unicode 텍스트 매핑을 검사합니다.

로컬 모의 검사는 실제 서비스 검증을 대체하지 않습니다. 운영의 실제 결과는 상위 [DEPLOYMENT.md](../DEPLOYMENT.md)에 기록합니다.
