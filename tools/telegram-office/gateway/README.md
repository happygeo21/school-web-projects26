# GeoTeacher 무료 단일 입력창 — Cloudflare Worker 설치

## 설계 원칙

- **기존 Telegram 봇 그대로 사용. 새로운 봇 생성 금지.**
- **GitHub Actions**: 정기 GitHub·Notion 비민감 알림 **발송** 전담 (기존 설정 보존).
- **Cloudflare Worker**: 사용자의 Telegram 명령 **수신** 및 기본 응답 전담.
- **Aside Free**: Windows에서 직접 웹 작업을 실행. Channels 원격 연결은 불가능하며 별도로 구매하지 않음.
- **Notion**: 원본 기록 및 아침 브리핑 알림. 같은 아침 브리핑을 Telegram으로 또 보내지 않음.
- 학생 이름, 학번, 성적, 상담, 출결, 연락처 등은 봇에 입력하거나 외부로 전송하지 않음.

## 현재 구현: 기본 명령 (AI 호출 비용 0원)

| 입력 | 처리 |
|---|---|
| /start, /help, 도움말 | 메뉴 설명 |
| /ping, 연결 | 개인 Telegram 채팅 명령 수신 확인 |
| /status, 상태 | GitHub 알림 워크플로 최신 실행 결과 공개 API 조회 |
| /today, 오늘, 업무 | 기존 Notion 업무운영실 링크(브리핑 본문 중복 전송 금지) |
| /projects, 프로젝트 | GitHub·기억의 좌표 공개 지도 등 링크 |
| /aside, 어사이드 | Windows Aside 수동 작업 안내 |
| 다른 자유 입력 | **실행하지 않고** 지원 명령 안내 |

이 명령은 GPT 대화, Aside 원격 제어, Notion 편집을 **하지 않습니다**.
신규 민감 정보 저장/전송 기능을 추가하기 전 교사 승인 필요.

## 연결 절차 — Cloudflare 대시보드 이용 (PC)

### 1. Worker 만들기

1. [Cloudflare Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)에 접속.
2. **Create → Worker**로 새 Worker를 만들고 이름을 \`geoteacher-telegram-gateway\`로 지정.
3. 작업 화면의 **Edit code**에서 [\`src/index.js\`](./src/index.js) 내용을 전체 복사하여 붙여넣고 **Deploy**.
4. Worker에 표시되는 \`https://...workers.dev\` 주소를 따로 기록합니다.
5. \`https://...workers.dev/health\`에 접속했을 때 \`ok\`가 나오면 기본 배포 성공.

### 2. Worker 비공개 값 3개 등록

해당 Worker의 **Settings → Variables and Secrets → Add → Secret**에서 아래 3개를 등록:

- \`TELEGRAM_BOT_TOKEN\`: 이미 GitHub Secrets에 입력했던 BotFather 발급 토큰
- \`TELEGRAM_CHAT_ID\`: GitHub \`pair\` 실행 로그의 숫자 채팅 ID
- \`TELEGRAM_WEBHOOK_SECRET\`: 임의로 **32자 이상 영문·숫자**로 새로 만든 무작위 비밀값

세 값 모두 *Secret* 유형. 코드, Variables(일반 텍스트), Notion, 공개 PR에 절대 복사하지 마세요.
새 웹훅 비밀값은 Worker와 GitHub Actions에 **같은 값**을 등록해야 합니다.

### 3. GitHub Actions에 웹훅 연결 설정

[GitHub Secrets](https://github.com/happygeo21/school-web-projects26/settings/secrets/actions)에서:

- **Repository secret** \`TELEGRAM_WEBHOOK_SECRET\`: 2단계와 동일한 새 비밀값
- 기존 \`TELEGRAM_BOT_TOKEN\`은 **그대로 유지**
- **Repository variable** \`TELEGRAM_WORKER_URL\`: 1단계 \`https://...workers.dev\` 주소(뒤에 \`/telegram-webhook\`은 넣지 않음)

[GitHub Actions — GeoTeacher Telegram Webhook Setup](https://github.com/happygeo21/school-web-projects26/actions/workflows/teacher-telegram-webhook-setup.yml)에서
\`Run workflow → mode: install\` 선택해 실행합니다. 성공 시 Telegram API에
\`https://...workers.dev/telegram-webhook\`가 **유일한 메시지 수신기**로 등록됩니다.

설치 직후, 사용 중인 **기존 텔레그램 봇**에게 \`/ping\`을 보내
'Telegram 명령 수신 정상'이 회신되는지 확인합니다.
\`/status\`로 GitHub 최근 워크플로 결과 확인도 가능합니다.

**중요**: 웹훅 등록 후에는 기존 GitHub 알림 워크플로의 \`pair\` 모드를 **다시 실행하지 마세요**.
Telegram의 \`getUpdates\`와 webhook은 동시에 작동하지 않습니다.
기존 \`test\` 및 \`scan\` 모드는 \`sendMessage\` 발송이므로 정상 병행됩니다.

### 4. 문제가 생기면 즉시 원복

\`GeoTeacher Telegram Webhook Setup → Run workflow → mode: remove\` 실행.

이는 Telegram 수신 웹훅만 제거합니다.
기존 GitHub 자동 알림과 토큰, Notion 업무 내용은 바꾸지 않습니다.
해제 시 \`/ping\` 같은 새 명령은 응답하지 않지만 GitHub 정기 알림은 계속 보낼 수 있습니다.
\`mode: status\`로 현재 Telegram 웹훅 설정 상태만 조회할 수 있습니다.

## 무료 운영비와 한계

- Cloudflare Workers Free의 기본 한도는 하루 100,000 요청, 요청 1회당 CPU 시간 등 제한이 따릅니다.
- 개인용 기본 명령에는 별도 AI API 호출이나 KV DB가 없어 추가 사용료를 예상하지 않습니다(할당량 내).
- 인식되는 명령에만 응답합니다. ChatGPT Plus 구독을 Telegram에서 GPT API처럼 호출하는 방식이 아닙니다.
- 실제 Aside Free 브라우저 작업은 Aside 앱에서 직접 수행합니다.
- GitHub Actions의 정기 스캔은 기본 브랜치 시간 예약 실행이며 지연될 수 있습니다.
- 전송 실패 후 Telegram 재시도 시 응답이 중복될 수 있어, 후속 기능 확장 시 이벤트 ID 기반 중복 제거가 필요합니다.

## 확장 순서 (아직 미구현)

1. Notion에서 오늘 마감·열린 업무 **건수만** 읽어 /today에 추가 (읽기 전용, 중복 알림 금지).
2. Google Calendar 일정 건수, Gmail 지정 라벨의 메일 건수 연동 (Google 인증/동의 필요).
3. GitHub 배포 실패·PR 승인 대기 경보를 중요도별로 구분하고 중복 제거.
4. \`/request\` — 교사가 입력한 **비민감 업무 요청**을 승인 대기함에 기록, Aside에서 수동 처리.
5. 수신 웹훅을 하나로 유지하면서 필요하면 PC 로컬 보조 실행기를 별도 연결. Cloudflare와 Aside 양쪽이 직접 \`getUpdates\`를 사용하도록 하지 않음.

- 공식 [Telegram Bot API](https://core.telegram.org/bots/api)
- [Cloudflare Workers Free 한도](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Worker 비밀값](https://developers.cloudflare.com/workers/configuration/secrets/)
- [기존 운영 원칙](../UNIFIED_OPERATIONS.md)
