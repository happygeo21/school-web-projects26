# GeoTeacher 업무운영실 3.0 — Telegram × Aside × Notion × GitHub 통합 운영 기준

> **단일 입력창 목표 / 2026-11-03 기준**
>
> 이 문서는 `텔레그램 자동화 전략`과 `어사이드 활용법 정리`의 공통 설계를 하나로 합친 **기술 운영 기준**입니다.
> 기존 학생용 앱과 기존 Notion 아침 브리핑을 재구성하지 않습니다.

## 1. 하나의 봇, 두 가지 별도 기능

| 구성 요소 | 담당 역할 | 상태 | 운영 위치 |
|---|---|---|---|
| **기존 GeoTeacher Telegram 봇** | 사용자에게 보여지는 단 하나의 대화창 | `pair`·`test` 수신 확인 | Telegram |
| **GitHub Actions → Telegram** | GitHub 실패/신규 PR, 선택된 Notion 수정 여부를 비민감 요약으로 발송 | 테스트 확인, 평일 16:50 KST 스캔 설정 | GitHub 클라우드 |
| **Aside → Telegram (선택)** | Telegram으로 받은 자연어를 실제 브라우저 작업으로 실행하고 결과 회신 | **아직 연결되지 않음** | 사용자 PC, Aside 실행 중일 때 |
| **ChatGPT** | 설계·분석·검토 및 필요 시 개발 도구 연결 | 대화용, Telegram의 백엔드로 자동 연결된 것 아님 | ChatGPT |
| **Codex** | 코드 수정, 테스트, PR·배포 | 작업별 실행 | 개발 환경 |
| **Notion** | 업무 원본, 완료 여부, 아침 브리핑의 유일한 알림 창구 | 기존 시스템 유지 | Notion |
| **Google / Firebase / Netlify** | 메일·일정·웹 프로젝트의 상태 원천 | Telegram 연동은 향후 별도 인증 필요 | 각 서비스 |

**원칙**: 동일 업무의 상태 원본은 하나이며, Telegram은 알림과 지시가 오가는 인터페이스일 뿐 원본 DB가 아니다.

## 2. 중복 방지

1. 기존 ChatGPT 예약 작업은 계속 Notion에 브리핑을 기록한다. 같은 브리핑을 Telegram에 다시 전달하지 않는다.
2. Notion의 `04 · 아침 업무 브리핑 | 알림함`은 `NOTION_WATCH_PAGES`에서 제외한다.
3. GitHub Actions는 **전송만** 수행한다. 페어링을 끝낸 뒤 `pair` 모드는 다시 실행하지 않는다.
4. Aside Channels를 사용한다면 **Aside만 Telegram 명령을 수신**한다.
5. Cloudflare Worker나 다른 Telegram 폴링 프로그램을 **같은 봇의 추가 명령 수신기로 동시에 켜지 않는다**.
6. Telegram 활동 건수와 알림 종류는 중복 전송되지 않도록 후속 개발 때 이벤트 ID 기반 중복 제거를 도입한다.

### Telegram 수신 충돌의 이유

Bot API의 `getUpdates`와 webhook은 동시 사용 불가이며, 다수의 폴링 수신 프로그램도 메시지를 서로 소모할 수 있다.
반면 `sendMessage`는 메시지 발송 API이므로 GitHub의 **발송 전용 작업**은 Aside의 수신 운영과 별도로 유지할 수 있다.

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Aside 공식 채널 연결](https://docs.aside.com/help/channels)
- [Aside 공식 Telegram 연결](https://docs.aside.com/help/channels-telegram)

## 3. Aside 원격 사용 경로

**3-A. 사용 중인 Aside 요금제에서 Channels 메뉴가 활성화된 경우**

1. Aside 앱을 실행한 PC에서 `Settings > Channels > Telegram > Manual`을 연다.
2. 새 봇을 만들지 말고, 현재 BotFather에서 발급받은 **같은 봇 토큰**을 Aside의 보안 입력창에 등록한다.
3. 본인 계정으로 봇에 테스트 명령을 전송한다.
4. Aside의 `Pairing` 탭에서 본인 계정을 승인한다.
5. Side effect가 있는 작업은 Aside `Read only` 또는 승인형 `Guard`로 시작한다.
6. 테스트: '기억의 좌표 공개 페이지만 읽기 전용으로 점검하고 링크 2개를 보고해 줘.' (비민감 공개 페이지 전용).

Aside가 종료되거나 PC가 꺼지면 **Aside 명령은 처리되지 않는다**. GitHub의 정기 알림은 계속 동작할 수 있다.
다른 Telegram 수신기(예: Cloudflare webhook)는 연결하지 않는다.

**3-B. Aside 무료 플랜에서 Channels가 잠긴 경우**

- 새 유료 결제를 진행하지 않는다. 현행 Telegram 알림 체계는 그대로 유지한다.
- Aside의 Windows 앱을 직접 실행해 브라우저 검증을 하거나, 추후 공식 CLI를 활용하는 **별도 로컬 브리지**를 안전성 검토 후 개발한다.
- Telegram의 단일 명령 입력 기능은 *미구현*으로 표기한다. ChatGPT 구독 연결만으로 Channels가 무료로 해제되는 것으로 간주하지 않는다.
- 대안: 단일 Telegram 수신기를 Cloudflare Worker로 구현한 후 `/status`, `/help` 등 **클라우드 기본 명령만** 제공할 수 있다. 이 경우 Aside Channels 직접 수신과 동시에 운영하지 않는다.

[Aside 구독](https://docs.aside.com/help/subscription) · [Aside CLI](https://docs.aside.com/help/developers) · [Aside 기기/PC 제약](https://docs.aside.com/help/devices)

## 4. Telegram 메시지 기준

- **즉시**: 웹사이트 접속 장애, 배포 실패, 인증 오류, 승인이 필요한 비민감 시스템 경보.
- **일일 묶음**: GitHub 활동 수, 변경된 비민감 프로젝트 페이지 수, 처리 대기 건수.
- **전송하지 않음**: 단순 저장, 정상 배포 로그, 학생 이름/학번/성적/출결/상담/연락처, 수업 원본 본문.
- **아침 브리핑**: 이미 받는 Notion 채널만 이용한다.
- 복수 서비스 연결 시 메시지에는 '[GitHub]', '[Notion]', '[시스템]' 등 출처와 처리 대상 URL을 기재한다.
- 기밀 정보는 Telegram에 붙여넣지 않고 권한 있는 원본 시스템에서 확인한다.

## 5. 현재 연결되어 검증된 것과 아닌 것

**검증됨**: 기존 BotFather 봇 발급; GitHub Secrets로 Telegram 토큰·채팅 ID 연동; `pair`, `test` 실행에서 Telegram 메시지 수신.

**코드/스케줄만 설정됨**: GitHub Actions `scan` 평일 16:50 KST; GitHub 최신 실패/PR 조회.

**추가 설정이 필요함**: Notion의 `NOTION_API_TOKEN` 읽기 전용 권한, `NOTION_WATCH_PAGES` 변수, Aside Channels/Pairing, Google 서비스 및 Firebase 조회 권한, 클라우드 수신 라우터. 위 기능들을 이미 작동한다고 주장하지 않는다.

## 6. 인수인계 및 다음 순서

1. **중복 방지 유지**: 새 Telegram 봇을 만들지 않고 현재 하나를 사용. 기존 Notion 브리핑 알림 설정 유지.
2. **Aside 요금제/Channels 확인**: 활성화되어 있으면 기존 봇을 `Manual`로 연결하고 승인, 무료 플랜 제한 시 무과금 방식 유지.
3. **Notion 프로젝트 상태 알림**: 브리핑 알림함 제외, *비민감 프로젝트*만 최소 읽기 권한.
4. **GitHub 알림 품질 개선**: 이벤트 ID 기반 중복 제거, 주말 누락 방지, 오류 등급 분류.
5. **Google/웹 프로젝트 확장**: 캘린더·Gmail 요약 건수, 기억의 좌표 승인 대기 **건수**, eGIS 상태점검.
6. **장기 운영**: 공용 대시보드 하나에서 설정 링크와 서비스별 헬스 상태 확인. 기존 프로젝트 원본을 수정하지 않는다.

## 7. 관련 링크

- [기존 GeoTeacher 알림 모듈](./README.md)
- [GitHub 텔레그램 자동화 워크플로](../../.github/workflows/teacher-telegram-notifications.yml)
- [교사 AI 업무운영실 통합 Notion 대시보드](https://app.notion.com/p/400abbdcebdc812f8aa3c1e6bf8b8b10)

**보안**: BotFather 토큰은 채팅/Notion/공개 소스코드에 기록하지 않는다. GitHub Secrets 또는 Aside의 안전한 자격증명 저장소만 사용한다. 공개 PR에 토큰이나 교내 개인정보를 포함하지 않는다.
