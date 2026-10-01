에너지 결정사 FINAL v10.3

핵심 수정
1. 포켓몬풍 캐릭터 이름을 자원 특성 반영형으로 수정
- 석탄 탄돌이
- 석유 기름돌이
- 천연가스 가스몽
- 원자력 코어링
- 수력 물결이
- 풍력 바람돌이
- 태양광 햇살이
- 바이오 새싹이
- 지열 불땅이

2. 학급 등록/학생 접속 PERMISSION_DENIED 대응
- databaseRoot: energyMatchV10_3
- teacherUid 충돌 로직 제거
- 빠른 실행용 공개 규칙(firebase-rules-open.json) 제공
- 권한 미적용 시 화면에 원인 안내 표시

반드시 할 일
1. Firebase Realtime Database > 규칙 탭 열기
2. 압축파일 안의 firebase-rules-open.json 내용을 전체 붙여넣기
3. '게시' 클릭
4. Netlify에 이 폴더 전체 재배포

교사용 암호
happygeo26
