# GeoTeacher 텔레그램 알림봇 — 1단계 설치

> **업무운영실 3.0 단일 운영 기준:** [Telegram × Aside × Notion × GitHub 통합 운영 문서](./UNIFIED_OPERATIONS.md)  
> 이미 생성한 GeoTeacher 봇을 계속 사용하며, Aside를 연결하더라도 새 봇을 만들지 않습니다. `pair` 명령은 Aside 연결 후 재실행하지 마세요.

기존 Notion 브리핑 및 학교 웹사이트를 변경하지 않고 **별도 알림 모듈**을 추가합니다.
현재 버전은 텔레그램 페어링/테스트, GitHub 최근 24시간 실패 실행·신규 PR,
허용한 Notion 페이지의 수정 여부 확인 기능만 제공합니다.
학생 이름·학번·성적·상담 내용은 전송하지 않습니다.

## 1. 본인이 BotFather에서 봇 생성

1. 텔레그램 [@BotFather](https://t.me/BotFather)에서 `/newbot`을 전송합니다.
2. **표시 이름**: `GeoTeacher 알림봇`
3. **고유 사용자명**: 예시 `GeoTeacherOffice26_bot` (이미 사용 중이면 다른 이름).
4. 받은 **봇 토큰을 이 채팅, GitHub 코드, Notion 본문 등에 절대 붙여넣지 마세요**.
5. 새로 생성된 봇의 대화창에 `/start`를 보내세요.

## 2. GitHub Secrets에 봇 연결 정보 입력

이 PR을 검토·병합하기 전후로 저장소 `Settings → Secrets and variables → Actions`에서
`New repository secret`을 누르고 다음 이름으로 저장합니다.

- `TELEGRAM_BOT_TOKEN`: BotFather가 발급한 토큰

이 PR을 main에 병합하면 `Actions → GeoTeacher Telegram Notifications`가 나타납니다.
`Run workflow`에서 `pair`를 선택하세요.
실행 결과의 `Run Telegram office notifier` 로그에 `TELEGRAM_CHAT_ID=숫자`가 표시됩니다.
그 숫자를 동일한 메뉴의 **Repository secret** `TELEGRAM_CHAT_ID`로 등록하세요.
이후 `test` 모드로 테스트하면 자신의 텔레그램에 시험 메시지가 도착합니다.

**안전장치**: 봇에 `/start`를 보낸 개인 대화가 정확히 하나일 때만 페어링합니다.
다른 사람이 봇을 시작해 후보가 여러 개면 실패하도록 설계했습니다.

## 3. Notion 연동 (선택)

1. [Notion 연결 관리](https://www.notion.so/profile/integrations)에서 **읽기 전용** API 연결을 만듭니다.
2. 감시할 비민감 프로젝트 페이지에만 연결 권한을 부여합니다.
3. GitHub **Repository secret**에 `NOTION_API_TOKEN` 값을 등록합니다.
4. GitHub **Repository variable**에 `NOTION_WATCH_PAGES`를 등록합니다.
   입력 형식은 `프로젝트명=32자리페이지ID;프로젝트명2=32자리페이지ID`입니다.

예시 (가짜 ID):
```text
업무대시보드=0123456789abcdef0123456789abcdef;eGIS=abcdef0123456789abcdef0123456789
```

**주의**: 기존 `04 · 아침 업무 브리핑 | 알림함`은 감시 대상에서 제외합니다.
이미 Notion 알림을 받으므로 텔레그램 중복 알림을 만들지 않기 위함입니다.
이 모듈은 페이지 마지막 수정 시각만 조회하며 본문/학생 자료는 읽지 않습니다.

## 4. 실행 방식

- 평일 16:50 한국시간: 최근 24시간 활동 확인 후 변경 또는 오류가 있을 때만 전송
- 수동: `Actions → GeoTeacher Telegram Notifications → Run workflow → scan`
- GitHub Actions의 예약 실행은 시간 지연이 발생할 수 있습니다.
- 스케줄은 workflow가 **main에 병합되어야** 작동합니다.
- 별도 유료 서버는 사용하지 않지만 제공 서비스의 무료 사용량 제한은 있습니다.

## 5. 다음 확장

Gmail·Google Calendar·Google Sheets: Google Apps Script 연동(개인정보 제외한 건수만).
기억의 좌표·Firebase: 결과물 승인 대기 건수.
eGIS·Netlify: 배포/접속 장애.
추후 텔레그램 `/today` 등 양방향 명령 기능 확장.

**아직 연결되지 않은 것**: 봇 계정 자체, GitHub Secrets, Notion API 토큰,
Gmail·Calendar·Firebase 등의 실제 시스템 연동. 사용자 계정의 인증이 필요합니다.
