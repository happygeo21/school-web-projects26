# k-skill 연결 현황 및 전체 사용 안내

확인일: 2026-10-19 / 대상: [NomaDamas/k-skill](https://github.com/NomaDamas/k-skill)

> **주의:** 이 문서는 설치 완료 증명이 아닙니다. GitHub에 문서를 저장하는 것과 Windows PC에 스킬을 설치하는 것, ChatGPT에 MCP를 연결하는 것은 별개입니다. 아래 모든 k-skill의 **로컬 Codex 설치 상태는 확인되지 않음**입니다. 일부 ChatGPT 도구는 동등하거나 유사한 기능만 이미 연결되어 있습니다.

## 전체 설치: Windows PowerShell (본인 컴퓨터에서 실행)

```powershell
node --version
npm --version
npx --yes skills add NomaDamas/k-skill --all -g
npx --yes skills ls -g
npx -y @nomadamas/k-skill@0 list
```

Codex에서 다음을 지시: `k-skill-setup 스킬을 사용해서 인증정보와 환경 변수 상태를 점검해 줘. 비밀키는 절대 출력하거나 GitHub에 올리지 마.`

개별 사용법: `npx -y @nomadamas/k-skill@0 instruct <스킬명>`으로 최신 안내 확인. 필요한 실행 helper는 해당 안내 문서에 따름. `@nomadamas/k-skill@0` CLI는 스킬 설치와는 다른 명령입니다.

## 보안

- GitHub 저장소에 API 키·쿠키·로그인 파일·학생 개인정보 업로드 금지.
- 로컬 `~/.config/k-skill/secrets.env` 에 비밀값을 보관하고 접근권한을 제한. Windows에서는 해당 폴더의 NTFS 권한을 확인.
- 인증 및 결제/예약/채팅 전송은 사용자가 명시적으로 승인한 경우에만 수행.
- 사용량 분석을 끄려면 `KSKILL_ANALYTICS_DISABLED=1` 환경변수 설정.

## 연결 상태 정의

- GitHub: 이 문서만 **설치 가이드 등록**; 외부 k-skill 코드/실행환경 미배포.
- ChatGPT: k-skill 자체는 **미설치**; 일부 비슷한 도구는 ChatGPT에서 이용 가능.
- Windows/Codex: **미검증**(사용자 PC 명령 실행 결과를 이 세션에서 볼 수 없음).

## 전체 항목별 점검 및 실행 명령 (131개)

| # | 기능 | 스킬명 | ChatGPT 현재 상태 | GitHub 상태 | Codex/PC 상태 | 개별 사용법 |
|---:|---|---|---|---|---|---|
| 1 | 철도 통합 시간표 조회 | `railway-timetable` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct railway-timetable` |
| 2 | 고속버스 예매 | `express-bus-booking` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct express-bus-booking` |
| 3 | 시외버스 예매 | `intercity-bus-booking` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct intercity-bus-booking` |
| 4 | 항공권 가격 조회 | `flight-ticket-search` | Skyscanner/Trip.com 연결 가능 (동일 스킬 아님) | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct flight-ticket-search` |
| 5 | 마이리얼트립 MCP 검색 | `myrealtrip-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct myrealtrip-search` |
| 6 | 외교부 해외안전·여행경보 조회 | `mofa-travel-safety` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct mofa-travel-safety` |
| 7 | 자연휴양림 빈 객실 조회 | `foresttrip-vacancy` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct foresttrip-vacancy` |
| 8 | 서울 지하철 도착정보 조회 | `seoul-subway-arrival` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct seoul-subway-arrival` |
| 9 | 서울 따릉이 실시간 대여소 조회 | `seoul-bike` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct seoul-bike` |
| 10 | 서울 실시간 혼잡도 조회 | `seoul-density` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct seoul-density` |
| 11 | 한국 대중교통 길찾기 | `korean-transit-route` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-transit-route` |
| 12 | 카카오맵 장소·자동차 길찾기 | `kakao-map` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kakao-map` |
| 13 | 고속도로 교통량·소통·CCTV 조회 | `highway-traffic-status` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct highway-traffic-status` |
| 14 | KOMSA 연안여객선 정보 조회 | `komsa-ferry-info` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct komsa-ferry-info` |
| 15 | 근처 가장 싼 주유소 찾기 | `cheap-gas-nearby` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct cheap-gas-nearby` |
| 16 | 근처 공영주차장 찾기 | `parking-lot-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct parking-lot-search` |
| 17 | 전기차 충전소 위치·상태 조회 | `ev-charger-nearby` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct ev-charger-nearby` |
| 18 | 지하철 분실물 조회 | `subway-lost-property` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct subway-lost-property` |
| 19 | 한국 부동산 실거래가 조회 | `real-estate-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct real-estate-search` |
| 20 | 한국 주택 공시가격 조회 | `housing-official-price` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct housing-official-price` |
| 21 | 개별공시지가 조회 | `gongsijiga-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct gongsijiga-search` |
| 22 | 건축물대장 표제부 조회 | `building-register-search` | 건축물대장 MCP 연결 가능 (동일 스킬 아님) | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct building-register-search` |
| 23 | LH 청약 공고문 조회 | `lh-notice-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct lh-notice-search` |
| 24 | SH 청약·주택 공고문 조회 | `sh-notice-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct sh-notice-search` |
| 25 | 법원 경매 부동산 매각공고 조회 | `court-auction-notice-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct court-auction-notice-search` |
| 26 | 당근부동산 검색 | `daangn-realty-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct daangn-realty-search` |
| 27 | 한국 법령 검색 | `korean-law-search` | 한국 법령 MCP 연결 가능 (동일 스킬 아님) | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-law-search` |
| 28 | 한국 특허 정보 검색 | `korean-patent-search` | 특허 MCP 연결 가능 (동일 스킬 아님) | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-patent-search` |
| 29 | 한국 개인정보처리방침·이용약관 자동 생성 | `korean-privacy-terms` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-privacy-terms` |
| 30 | 등기부등본 자동화 | `iros-registry-automation` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct iros-registry-automation` |
| 31 | 법인등기 신청 컨설팅 | `corporate-registration-consulting` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct corporate-registration-consulting` |
| 32 | 지급명령 신청 보조 | `court-payment-order-assistant` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct court-payment-order-assistant` |
| 33 | 국회 의안·표결 조회 | `assembly-bill-vote-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct assembly-bill-vote-search` |
| 34 | 공무국외출장 보고서 조회 | `gov-overseas-trip-report` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct gov-overseas-trip-report` |
| 35 | 공유누리 공공시설 검색 | `sharenuri-facility-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct sharenuri-facility-search` |
| 36 | 사업자등록정보 확인 | `nts-business-registration` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct nts-business-registration` |
| 37 | 사업자 실사 종합 | `biz-health-check` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct biz-health-check` |
| 38 | 국민연금 가입 사업장 조회 | `national-pension-workplace` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct national-pension-workplace` |
| 39 | 국세 체납 명단공개 검색 | `nts-tax-delinquency` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct nts-tax-delinquency` |
| 40 | 금융위 기업기본정보 조회 | `fsc-corporate-info` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct fsc-corporate-info` |
| 41 | 인허가 영업상태 조회 | `localdata-business-status` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct localdata-business-status` |
| 42 | 장수 점포 레이더 | `store-longevity-radar` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct store-longevity-radar` |
| 43 | 한국 사업자 장부 자동화 | `korean-jangbu-for` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-jangbu-for` |
| 44 | 팝빌 업무 API | `popbill` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct popbill` |
| 45 | 네이버 검색광고 성과 조회 | `naver-ad-performance` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct naver-ad-performance` |
| 46 | 창업진흥원 K-Startup 조회 | `kstartup-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kstartup-search` |
| 47 | 정부지원 전수조사 | `government-support-survey` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct government-support-survey` |
| 48 | 나라장터 발주계획 검색 | `g2b-order-plan-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct g2b-order-plan-search` |
| 49 | 부정당제재업체 조회 | `g2b-sanctioned-supplier` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct g2b-sanctioned-supplier` |
| 50 | 국방전자조달 공고 조회 | `d2b-notice-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct d2b-notice-search` |
| 51 | S2B 학교장터 공고 조회 | `s2b-notice-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct s2b-notice-search` |
| 52 | 전기차 보조금 현황 조회 | `ev-subsidy-status` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct ev-subsidy-status` |
| 53 | 잡코리아 인재검색 | `jobkorea-talent-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct jobkorea-talent-search` |
| 54 | 사람인 인재풀 검색 | `saramin-talent-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct saramin-talent-search` |
| 55 | 이력서 기반 채용공고 매칭 | `job-posting-match` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct job-posting-match` |
| 56 | 당근알바 검색 | `daangn-jobs-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct daangn-jobs-search` |
| 57 | 한국 주식 정보 조회 | `korean-stock-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-stock-search` |
| 58 | 한국 채권 종목 조회·비교 | `korean-bond-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-bond-search` |
| 59 | 금감원 DART 전자공시 조회 | `k-dart` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct k-dart` |
| 60 | 국내·해외 기업분석 | `company-analysis` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct company-analysis` |
| 61 | 토스증권 조회 | `toss-investment` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct toss-investment` |
| 62 | 대신증권 리포트 조회 | `daishin-report-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct daishin-report-search` |
| 63 | 국가데이터처 KOSIS 통계 조회 | `kosis-stats` | korean_stats MCP 연결 가능 (동일 스킬 설치 아님) | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kosis-stats` |
| 64 | 한국은행 ECOS 경제통계 조회 | `bok-ecos-stats` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct bok-ecos-stats` |
| 65 | 한·미 국채시장 분석 | `government-bond-analysis` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct government-bond-analysis` |
| 66 | 멀티에셋 모닝 브리핑 | `multi-asset-morning-briefing` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct multi-asset-morning-briefing` |
| 67 | 사건별 시장반응 리서치 | `market-event-impact` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct market-event-impact` |
| 68 | 근처 응급실 병상 상태 확인 | `emergency-room-beds` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct emergency-room-beds` |
| 69 | 장기요양·건강검진기관 조회 | `nhis-care-checkup-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct nhis-care-checkup-search` |
| 70 | 의약품 안전 체크 | `mfds-drug-safety` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct mfds-drug-safety` |
| 71 | 식품 안전 체크 | `mfds-food-safety` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct mfds-food-safety` |
| 72 | 동물약국·동물용의약품 취급 약국 조회 | `animal-pharmacy-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct animal-pharmacy-search` |
| 73 | 쿠팡 상품 검색 | `coupang-product-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct coupang-product-search` |
| 74 | 네이버 쇼핑 가격비교 | `naver-shopping-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct naver-shopping-search` |
| 75 | 다나와 최저가 비교 | `danawa-price-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct danawa-price-search` |
| 76 | 마켓컬리 상품 조회 | `market-kurly-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct market-kurly-search` |
| 77 | 다이소 상품 조회 | `daiso-product-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct daiso-product-search` |
| 78 | 올리브영 검색 | `olive-young-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct olive-young-search` |
| 79 | 오늘의집 오늘의딜 조회 | `ohou-today-deal` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct ohou-today-deal` |
| 80 | 번개장터 검색 | `bunjang-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct bunjang-search` |
| 81 | 당근 중고거래 검색 | `daangn-used-goods-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct daangn-used-goods-search` |
| 82 | 당근중고차 검색 | `daangn-cars-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct daangn-cars-search` |
| 83 | 소비자 가격·리콜정보 조회 | `consumer-price-safety-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct consumer-price-safety-search` |
| 84 | 택배 배송조회 | `delivery-tracking` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct delivery-tracking` |
| 85 | KAMIS 농수축산물 가격 조회 | `kamis-food-price` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kamis-food-price` |
| 86 | 근처 술집 조회 | `kakao-bar-nearby` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kakao-bar-nearby` |
| 87 | 올라포케 역삼 포케 | `hola-poke-yeoksam` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct hola-poke-yeoksam` |
| 88 | BC카드 eat.pl 맛집 검색 | `bccard-eatpl-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct bccard-eatpl-search` |
| 89 | 한국 마라톤 일정 조회 | `korean-marathon-schedule` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-marathon-schedule` |
| 90 | KBO 경기 결과 조회 | `kbo-results` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kbo-results` |
| 91 | KBL 경기 결과 조회 | `kbl-results` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kbl-results` |
| 92 | K리그 경기 결과 조회 | `kleague-results` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kleague-results` |
| 93 | LCK 경기 분석 | `lck-analytics` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct lck-analytics` |
| 94 | 영화관 검색 | `korean-cinema-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-cinema-search` |
| 95 | 공연 일정·잔여석 조회 | `ticket-availability` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct ticket-availability` |
| 96 | KOPIS 공연 조회 | `kopis-performance-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kopis-performance-search` |
| 97 | 로또 당첨 확인 | `lotto-results` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct lotto-results` |
| 98 | 조선왕조실록 검색 | `joseon-sillok-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct joseon-sillok-search` |
| 99 | 국가유산 검색·행사 조회 | `korean-heritage-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-heritage-search` |
| 100 | 종교시설 찾기 | `religious-facility-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct religious-facility-search` |
| 101 | 장학금 검색 및 조회 | `korean-scholarship-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-scholarship-search` |
| 102 | 학교 급식 식단 조회 | `k-schoollunch-menu` | 학교정보 MCP 연결 가능 (동일 스킬 아님) | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct k-schoollunch-menu` |
| 103 | 도서관 도서 조회 | `library-book-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct library-book-search` |
| 104 | KERIS/RISS 학술자료 검색 | `keris-academic-search` | 학술 검색/리서치 기능으로 일부 대체 가능 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct keris-academic-search` |
| 105 | 네이버 뉴스 검색 | `naver-news-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct naver-news-search` |
| 106 | 한국일보 뉴스 조회 | `hankookilbo-news` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct hankookilbo-news` |
| 107 | 네이버 블로그 리서치 | `naver-blog-research` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct naver-blog-research` |
| 108 | 긱뉴스 조회 | `geeknews-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct geeknews-search` |
| 109 | 한국어 맞춤법 검사 | `korean-spell-check` | ChatGPT 일반 텍스트 교정 가능 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-spell-check` |
| 110 | 한국어 AI 윤문 | `korean-humanizer` | ChatGPT 일반 윤문 가능 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-humanizer` |
| 111 | 한국어 유행어 글쓰기 | `korean-slang-writing` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-slang-writing` |
| 112 | 한국 중세 국어풍 변환 | `korean-middle-korean` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-middle-korean` |
| 113 | 한국어 글자 수 세기 | `korean-character-count` | ChatGPT/Python 글자 수 계산 가능 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-character-count` |
| 114 | 한국 날씨 조회 | `korea-weather` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korea-weather` |
| 115 | 서울 기상 위험 시간대 조회 | `seoul-weather-risk` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct seoul-weather-risk` |
| 116 | 사용자 위치 미세먼지 조회 | `fine-dust-location` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct fine-dust-location` |
| 117 | 한강 수위 정보 조회 | `han-river-water-level` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct han-river-water-level` |
| 118 | 한국 공휴일·특일 조회 | `korean-holiday-calendar` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct korean-holiday-calendar` |
| 119 | 우편번호 검색 | `zipcode-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct zipcode-search` |
| 120 | 생활쓰레기 배출정보 조회 | `household-waste-info` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct household-waste-info` |
| 121 | 근처 공중화장실 찾기 | `public-restroom-nearby` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct public-restroom-nearby` |
| 122 | 기부처 조회 | `donation-place-search` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct donation-place-search` |
| 123 | 카카오톡 Mac 아카이브 검색 | `kakaotalk-mac` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kakaotalk-mac` |
| 124 | HWP 문서 조회/변환 | `hwp` | 기존 한국교사 HWP 스킬 이용 가능 (동일 스킬 아님) | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct hwp` |
| 125 | HWP 문서 편집 | `rhwp-edit` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct rhwp-edit` |
| 126 | HWP 레이아웃·IR 디버깅 | `rhwp-advanced` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct rhwp-advanced` |
| 127 | KR WHOIS 조회 | `kr-whois-lookup` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct kr-whois-lookup` |
| 128 | 사주 운세 풀이 | `saju-fortune` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct saju-fortune` |
| 129 | 작명소 | `naming-house` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct naming-house` |
| 130 | K-스킬 공통 설정 | `k-skill-setup` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct k-skill-setup` |
| 131 | K-스킬 클리너 | `k-skill-cleaner` | 해당 k-skill 직접 연결은 미확인 | 안내문 등록(코드 미설치) | 미검증 | `npx -y @nomadamas/k-skill@0 instruct k-skill-cleaner` |

## 설치 직후 점검

1. `npx --yes skills ls -g` 출력에 원하는 스킬명이 나오는지 확인.
2. Codex에게 `k-skill-setup`을 실행하도록 요청.
3. 각 스킬에 대해 `instruct`를 먼저 읽고, 조회만 가능한 기능을 우선 테스트.
4. Windows에서 macOS 전용 `kakaotalk-mac`은 실행 불가. 별도 macOS 필요.
5. 오류가 있으면 로그에서 키·토큰·개인정보를 지운 뒤 점검.

공식 근거: [GitHub README](https://github.com/NomaDamas/k-skill), [설치 설명](https://github.com/NomaDamas/k-skill/blob/main/docs/install.md)
