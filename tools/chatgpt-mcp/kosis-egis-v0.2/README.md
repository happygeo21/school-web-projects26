# KOSIS–eGIS 자동화 v0.2

KOSIS JSON/CSV 자료를 5자리 시군구 코드별 `code,name,value` CSV로 변환·검증하는 도구입니다.

실행 패키지: 이 작업의 ChatGPT 대화에서 제공한 ZIP 파일(파이썬 변환기 및 예시 포함)을 사용하세요.

## 공식 KOSIS 실시간 조회
원본 [k-skill KOSIS](https://github.com/NomaDamas/k-skill/blob/main/docs/features/kosis-stats.md) 도움말을 사용합니다.

```powershell
npx -y @nomadamas/k-skill@0 exec kosis-stats scripts/run_kosis_stats.py -- search --query "시군구 인구" --text
```

실제 조회로 통계표 ID, 분류, 연도, 단위를 확인한 후 결과 파일을 변환합니다. 이 변환기는 자체적으로 실시간 API에 접속하지 않습니다. ChatGPT 스킬 업로드만으로 자동 API 실행이 되지 않습니다.

## 변환
```powershell
python kosis_to_egis.py --input sample_kosis.csv --output egis.csv --code-field 시군구코드 --name-field 지역명 --value-field 수치 --period 2025
```

- 코드가 5자리가 아니면 오류로 기록하고 제외합니다.
- 같은 코드가 여러 번 나오면 중복을 보고합니다.
- `--reference 기준시군구.csv`는 `code` 열을 가진 CSV로, 누락·초과 코드를 검증합니다.
- 실제 eGIS의 **레이어 키**는 레이어 속성명에서 확인하세요. CSV 속성키는 `code`입니다.
- 252개 시군구 전수 여부와 행정구역 개편 일치 여부는 기준 참조 CSV로 검증해야 합니다.
- 스크립트 예시 수치는 실측 KOSIS 값이 아닙니다.
