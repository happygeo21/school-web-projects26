# 단일 노션 운영 허브 동기화 표준

**대표 노션:** [GitHub · AI 도구 통합 운영 허브](https://app.notion.com/p/3f1abbdcebdc8137adddf8d80317fcc4)

- [프로젝트·도구 관리대장](https://app.notion.com/p/a93abb488bd343c68d6756cd950ff8f1)
- [변경·배포 로그](https://app.notion.com/p/92022425cbfa4549ab30d6589a0206fe)
- [외부 곰도리 25개 상세 목록](https://app.notion.com/p/3feabbdcebdc810f8b8cd9d67559a08e) — 참고 보존용
- [기존 GitHub 스크랩](https://app.notion.com/p/3fbabbdcebdc812f90c5e3922ca905a1) — 자료 저장소 원문 보존용

## 프로젝트 관리대장 / 변경 로그의 차이

1. 프로젝트 관리대장: 프로젝트 하나당 하나의 레코드만 유지. 현재 상태, GitHub·실행 URL, 확인한 배포, 마지막 확인일을 갱신.
2. 변경 로그: GitHub와 관련된 의미 있는 변경 1회마다 하나의 레코드를 새로 등록. 작업명, 대상, 날짜, **확인 가능한 commit/PR 링크**, GitHub/배포/Notion 상태와 KST 반영시각, 검증 링크, 남은 일을 기록.
3. GitHub의 전체 커밋을 매번 노션에 중복 복사할 필요 없음. 한 작업에서 여러 커밋이 나오면 최종 commit + 변경 핵심을 기록.
4. 보안 등 중대한 변경은 자세한 감사 문서와 해당 Notion 로그를 연결.

## 마무리 3중 확인

| 영역 | 완료 표시 조건 | 그렇지 않으면 |
|---|---|---|
| GitHub | 실제 commit SHA/PR URL 확인 | 검토 중 / 미완료 |
| 배포 | GitHub Actions 또는 Netlify Production deploy 성공 근거 확인 | 미확인 또는 미배포 |
| Notion | Notion 프로젝트/변경 로그 기록 후 재조회 성공 | **미반영(이유)** |

시간 표기: Asia/Seoul (KST), 날짜는 YYYY-MM-DD, 반영시각은 실제 시스템 기록 사용.

## 자동 동기화의 제한
- 이 지침과 `AGENTS.md`는 **운영 규칙**이지 Notion API 자동배포 서비스는 아닙니다.
- ChatGPT/코딩 에이전트가 노션에 접근 가능한 세션에서만 직접 쓰기 가능합니다.
- GitHub 웹 UI/로컬 PC/외부 작업에서 독립적으로 변경한 것은 채팅으로 확인하지 않는 이상 누락될 수 있습니다.
- 완전 무인 자동화에는 별도의 Notion 통합 인증·권한, GitHub Actions 전용 비밀키, 대상 DB의 API 접근 권한, 중복방지 식별자 등이 필요하며 사용자 승인 후 별도 구성해야 합니다.
- 학생정보와 인증키는 노션 작업 로그에도 저장하지 않습니다.

## 종료 메시지 양식
`GitHub: ✅ main 커밋 abc1234 | 배포: ✅ Pages 성공 / Netlify 미확인 | Notion: ✅ 대표 허브·변경 로그 반영 (KST YYYY-MM-DD HH:mm)`

도구가 없거나 수정에 실패한 경우:
`GitHub: ✅ | 배포: ⚠️ 미확인 | Notion: ⚠️ 미반영 — [정확한 사유]`

작성: 2026-10-19 (KST).
