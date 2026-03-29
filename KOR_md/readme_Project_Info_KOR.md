# Interactive Stock Theory Lab (Hackonomics 2026)

## 1) 프로젝트 개요
`Interactive Stock Theory Lab`은 해외주식 데이터를 활용해 금융 이론을 학습하는 교육용 웹앱입니다.  
핵심은 주가 예측이 아니라, 같은 실제 데이터라도 이론/가정/모델에 따라 해석이 달라진다는 점을 체험하도록 만드는 것입니다.

사용자는 티커를 입력하고 이론을 선택한 뒤 실행하면, 이론별 결과 카드(핵심 수치 + 그래프 + 설명 + What-if 조절)로 비교 학습을 진행할 수 있습니다.

## 2) 제작 목적
- 금융공학 이론을 수식 중심으로만 학습할 때 발생하는 이해 장벽 완화
- 실제 시장 데이터를 이론에 연결해 직관적인 학습 경험 제공
- 투자 권유가 아닌, 이론의 전제와 한계를 체계적으로 보여주는 교육 실험실 구현

## 3) 주요 기능
- 티커 기반 해외주식 가격 데이터 조회 (Alpha Vantage 연동)
- 기간 선택: `1M / 6M / 1Y / 3Y / 5Y / Custom`
- 이론 선택 후 일괄 실행
- 이론별 결과 카드 자동 생성
  - Theory Overview
  - Key Outputs (KPI)
  - Charts
  - Why this happened
  - What-if controls (슬라이더 즉시 반영)
- 이론 간 핵심 지표 비교 테이블 제공
- 반응형 UI (데스크톱/모바일 대응)

## 4) 구현 이론 (8개)
1. CAPM
2. Fama-French 3-Factor
3. Momentum Strategy
4. Mean Reversion Strategy
5. Efficient Frontier (Mean-Variance)
6. Risk Metrics Dashboard
7. Moving Average Crossover
8. Volatility Regime Risk Control

## 5) 기술 스택
- Frontend: `HTML`, `CSS`, `JavaScript`, `Tailwind CSS (CDN)`, `Chart.js`
- Backend: `Node.js` (내장 `http` 서버)
- Data API: `Alpha Vantage`
- Secret 관리: `.env`

## 6) 실행 방법 (로컬)
### 사전 준비
- Node.js 설치
- Alpha Vantage API Key 발급

### 환경 변수 설정
프로젝트 루트의 `.env` 파일에 아래 값 설정:

```env
ALPHA_VANTAGE_KEY=YOUR_API_KEY
PORT=3000
```

### 서버 실행
```powershell
cd ------
node server.js
```

### 브라우저 접속
```text
------ (local dev. environ. only.)
```

## 7) 사용 방법
1. 티커 입력 (예: `AAPL`, `MSFT`, `NVDA`, `SPY`)
2. 기간 선택
3. 이론 체크박스 선택
4. `Run` 클릭
5. 결과 영역에서 비교표 + 이론별 카드 확인
6. 슬라이더로 가정 변경 후 결과 변화 관찰

## 8) 결과물에서 확인할 수 있는 것
- 이론별 핵심 지표(예: beta, required return, drawdown, strategy return 등)
- 가격/전략/리스크 관련 차트
- 데이터 특징과 이론 결과를 연결한 해석 문장 (`Why this happened`)
- 가정 변경 시 결론이 달라지는 민감도 실험 결과

## 9) 프로젝트 구조 (요약)
```text
hackonomics2026/
├─ public/
│  ├─ index.html
│  ├─ styles.css
│  └─ js/
│     ├─ app.js
│     ├─ api.js
│     ├─ compute.js
│     └─ render.js
├─ server.js
├─ .env            (비공개)
├─ .env.example
├─ DISCLAIMER.md
├─ PRIVACY.md
├─ Project Story.md
├─ Project Story.ko.md
└─ readme.md
```

## 10) 제한사항 및 주의
- 무료 API 플랜 특성상 요청 제한/지연이 발생할 수 있음
- 데이터 제공자 상태에 따라 응답 실패 가능
- 본 서비스는 교육용이며 투자 자문이 아님

자세한 법적 고지는 아래 문서를 참고:
- `DISCLAIMER.md`
- `PRIVACY.md`

## 11) 라이선스
본 프로젝트는 `MIT License`를 따릅니다.  
(`LICENSE` 파일 기준)
