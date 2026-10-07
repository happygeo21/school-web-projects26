# 에너지 결정사 Firebase 보안 전환

교사용 화면의 브라우저 비밀번호 방식은 제거하고 Firebase Authentication 기반으로 전환했습니다.

## 적용 구조

- 학생: Firebase 익명 로그인
- 교사: Google 로그인 또는 Firebase 이메일·비밀번호 로그인
- 최종 권한 판정: Realtime Database Rules
- GitHub Pages 승인 도메인: `happygeo21.github.io`

## Realtime Database Rules에서 energyMatchV10_3만 교체

현재 `memoryTemperature2026/submissions/.read`에 사용 중인 **교사 이메일 허용 조건 전체**를 아래의 `TEACHER_EMAIL_CHECK` 자리에 그대로 복사합니다. 교사 이메일 목록은 공개 GitHub 저장소에 기록하지 않습니다.

```json
"energyMatchV10_3": {
  "$classCode": {
    "meta": {
      ".read": "auth != null",
      ".write": "auth != null && (TEACHER_EMAIL_CHECK)"
    },
    "students": {
      ".read": "auth != null && (TEACHER_EMAIL_CHECK)",
      "$uid": {
        ".read": "auth != null && (auth.uid == $uid || (TEACHER_EMAIL_CHECK))",
        ".write": "auth != null && (auth.uid == $uid || (TEACHER_EMAIL_CHECK))"
      }
    },
    "messages": {
      ".read": "auth != null",
      ".write": "auth != null && (TEACHER_EMAIL_CHECK)"
    }
  }
}
```

예를 들어 `TEACHER_EMAIL_CHECK`는 다음 형태입니다.

```text
auth.token.email == '교사1@example.com' || auth.token.email == '교사2@example.com'
```

## 점검 순서

1. 학생 페이지에서 Firebase 연결 완료 확인
2. 학급 코드로 학생 접속
3. 학생 1명이 활동을 저장
4. 교사용 페이지에서 Google 또는 이메일·비밀번호 로그인
5. 해당 학급을 열고 학생 데이터 확인
6. 교사 메시지 전송
7. 학생 페이지에서 메시지 수신 확인
8. 학생 활동 수정/삭제 권한이 교사에게만 있는지 확인

> 주의: Firebase 규칙을 바꾸기 전까지 기존 `".read": true, ".write": true` 상태는 보안상 안전하지 않습니다.
