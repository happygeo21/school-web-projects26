# 에너지 결정사 · GitHub 업데이트 방법

## 가장 쉬운 운영 방식
현재 GitHub 저장소의 `happygeo` 폴더를 사이트 원본으로 사용합니다.

ChatGPT가 새 버전을 만들어 주면 다음부터는 이렇게 요청하면 됩니다.

> "현재 happygeo GitHub 구조를 유지하고, GitHub 업데이트용으로 변경 파일만 만들어줘.
> Firebase 설정과 databaseRoot는 유지하고, student.html / teacher.html / index.html 중 바뀐 파일만 제공해줘."

그러면 전체 프로젝트를 매번 새로 만들 필요 없이 바뀐 파일만 교체하면 됩니다.

---

## GitHub에서 업데이트하는 순서

1. 새 버전 ZIP 압축 해제
2. GitHub 저장소의 `happygeo` 폴더와 같은 파일을 찾아 덮어쓰기
3. VS Code의 Source Control(소스 제어) 아이콘 클릭
4. 변경 파일 확인
5. 커밋 메시지 작성
   예: `update energy match v10.4`
6. Commit
7. Sync Changes / Push
8. Netlify가 GitHub 저장소와 연결되어 있다면 자동 재배포
9. 1~2분 뒤 사이트에서 Ctrl+F5로 확인

---

## 보통 교체하면 되는 파일

- `student.html` : 학생 화면, 문제, 캐릭터명, 교과서 자료
- `teacher.html` : 교사용 대시보드 및 관리 기능
- `index.html` : 시작 화면
- `firebase-config.js` : Firebase 프로젝트/암호/DB 경로 변경 때만
- `assets/profiles/...` : 캐릭터 이미지를 바꿀 때만

### 이번 v10.4의 특징
교과서 p04~p16 이미지는 `student.html` 안에 직접 포함했습니다.
따라서 GitHub에서 `assets/textbook` 일부 파일이 빠져도 수업 화면의 교과서 자료는 깨지지 않습니다.

---

## 절대 매번 바꿀 필요 없는 것
현재 정상 작동한다면 아래는 유지하세요.

`firebase-config.js`
- Firebase 프로젝트 정보
- databaseRoot: `energyMatchV10_3`
- teacherPasscode: `happygeo26`

Firebase Realtime Database 규칙도 기능 변경이 없는 한 다시 수정하지 않아도 됩니다.

---

## 추천 버전 관리 방식
커밋 메시지를 다음처럼 남기면 이전 버전으로 되돌리기 쉽습니다.

- `v10.4 textbook image fix`
- `v10.5 profile update`
- `v10.6 teacher dashboard update`

문제가 생기면 GitHub의 이전 커밋으로 되돌릴 수 있습니다.
