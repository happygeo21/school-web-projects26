# 공식 시설 캐시 갱신 (현재 실데이터 미확보)

1. 공식 문서 https://www.mpva.go.kr/mpva/contents.do?key=17 과 공식 지도에서 이용 조건·인증·응답 구조·CRS·위경도 축을 확인합니다. 문서 화면의 HTTP JSON URL은 `/api/json/allSearch.do`이며, HTTPS 지원과 CORS는 실제 응답으로 확인해야 합니다. 키를 브라우저·저장소·채팅에 넣지 않습니다.
2. 승인된 네트워크에서 TLS 검증을 유지하여 공식 HTTPS 응답을 저장합니다. HTTP로만 제공되면 브라우저 혼합 콘텐츠 우회를 하지 말고 기관의 배포 파일·안전한 제공 방법을 요청합니다. 이 환경의 프록시 차단은 우회하지 않습니다.
3. 원문은 저장소 밖에 보관하고 SHA256을 계산합니다. 필드 이름으로 좌표 순서를 추정하지 않습니다. EPSG:4326이 아닌 좌표는 공식 CRS 명세에 근거해 별도 검토한 변환을 거친 뒤 사용합니다. 변환 도구는 현재 좌표를 무조건 바꾸지 않습니다.
4. 다음 검토 JSON을 저장소 밖에서 작성합니다. 아래 값은 설명용 자리표시자이며 공식 API 응답 예시가 아닙니다. `recordsPath`는 배열의 실제 경로, `fields`는 실제 필드 이름입니다. 세 시설(전체가 세 곳 미만이면 전체)의 좌표를 공식 지도와 독립 대조하세요.

```json
{
  "reviewed": true,
  "sourceUrl": "https://mfis.mpva.go.kr/api/json/allSearch.do",
  "sourceSha256": "<원문 SHA256>",
  "updatedAt": "<YYYY-MM-DD>",
  "crs": "EPSG:4326",
  "coordinateEvidence": "<명세의 CRS·축·단위 및 독립 지도 대조 근거>",
  "responseEvidence": "<문서/실제 응답 구조 대조>",
  "authenticationEvidence": "<인증 필요 여부 확인; 키 값 금지>",
  "corsEvidence": "<실제 Origin 응답 확인 또는 브라우저 직접 호출 미사용>",
  "license": "<허용 용도·재배포·출처 표기·호출 제한>",
  "recordsPath": [],
  "fields": {"id":"<필드>","name":"<필드>","address":"<필드>","region":"<필드>","latitude":"<검증한 위도 필드>","longitude":"<검증한 경도 필드>"},
  "spotChecks": [{"id":"<시설 ID>","latitude":0,"longitude":0,"evidenceUrl":"https://mfis.mpva.go.kr/<확인 주소>"}]
}
```

5. `node veteransgeo/security/update-facility-cache.mjs /private/raw.json /private/review.json /private/cache-candidate.json`을 실행합니다. 기존 파일을 덮어쓰지 않으며, 체크섬·출처·좌표·전체 행·중복·대조점 검증 중 하나라도 실패하면 산출하지 않습니다. 이 검증은 사람이 작성한 출처/좌표 명세의 진실성을 자동 증명하지 않습니다.
6. 개인·연락처·API 키가 섞이지 않았는지와 시설명·주소 길이, 지역 표기(기존 학교 지역 표기와 일치)를 검토한 후 `official-facilities.json`에 반영하는 별도 커밋을 만듭니다. 실데이터가 없으면 기존 빈 캐시를 유지합니다.
7. 공식 캐시 장애 시 공식지도 외부 확인·일반 지명 검색·수동 핀·좌표 붙여넣기는 계속 사용할 수 있습니다. 일반 검색 결과를 공식 지정 근거로 간주하지 않습니다.
