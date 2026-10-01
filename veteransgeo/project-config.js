export const PROJECT = {
  title: "기억의 좌표 LIVE",
  subtitle: "공식 기록과 생활 속 기억을 잇는 7개 학교 공동 탐구",
  year: "2026",

  officialMapUrl: "https://mfis.mpva.go.kr/servicemap/serviceMapMain.do#none",

  schools: [
    { id: "S1", school: "공주여자고등학교", region: "충남 공주", center: [36.4466,127.1190], zoom: 12 },
    { id: "S2", school: "화순고등학교", region: "전남 화순", center: [35.0640,126.9860], zoom: 12 },
    { id: "S3", school: "순천왕운중학교", region: "전남 순천", center: [34.9506,127.4872], zoom: 12 },
    { id: "S4", school: "대전복수고등학교", region: "대전광역시 서구", center: [36.3035333,127.373425], zoom: 12 },
    { id: "S5", school: "여수충무고등학교", region: "전남 여수", center: [34.7604,127.6622], zoom: 12 },
    { id: "S6", school: "광주제일고등학교", region: "광주광역시", center: [35.1595,126.8526], zoom: 12 },
    { id: "S7", school: "여수문수중학교", region: "전남 여수", center: [34.7604,127.6622], zoom: 12 }
  ],

  categories: [
    "일제강점기·독립운동","6·25전쟁·호국","민주화운동",
    "경찰·치안","소방·재난안전","기타 보훈·공공기억"
  ],

  sourceTypes: [
    "현장 안내판·표석",
    "국가보훈부·현충시설정보",
    "국가·지자체·공공기관 자료",
    "박물관·기념관·지역사 자료",
    "도서·논문·언론 자료",
    "나의 판단"
  ],

  officialStatuses: [
    { value: "confirmed", label: "국가보훈부 현충시설 지도에서 확인함" },
    { value: "not_found", label: "현충시설 지도에서 찾지 못함" },
    { value: "not_checked", label: "아직 확인하지 못함" }
  ],

  awarenessLevels: [
    { value: 1, label: "1 · 전혀 몰랐다" },
    { value: 2, label: "2 · 이름만 들어봤다" },
    { value: 3, label: "3 · 장소·위치는 알고 있었다" },
    { value: 4, label: "4 · 역사적 의미까지 알고 있었다" }
  ]
};
