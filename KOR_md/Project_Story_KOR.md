# 프로젝트 스토리 - Interactive Stock Theory Lab

이 문서는 Hackonomics2026 해커톤 출품작의 프로젝트 스토리를 정리한 것입니다. 핵심 목표는 예측이 아니라 이해이며, 실제 시장 데이터를 활용해 다양한 투자 이론을 직접 적용하고 비교하도록 설계했습니다.

## Inspiration (영감)
저는 한국의 한림대학교 경영학과를 주전공으로 하고, 금융재무학과와 빅데이터학부를 복수전공 중인 3학년 학부생입니다. 다양한 금융이론을 학습할 때 금융공학의 이론과 수식만 보고 공부하다 보니, 실제 데이터에 적용하는 과정에서 이해의 어려움이 있었습니다. 단순히 이론을 학습하는 것에서 멈추지 않고, 저처럼 이론 이해에 어려움을 겪는 학생들에게 도움이 되는 도구가 필요하다고 생각해 교육용 웹을 프로젝트 주제로 선택했습니다.

## What it does (무엇을 하는가)
- 사용자가 해외주식 티커를 입력하면 최신 시장 데이터를 불러옵니다.
- 8개 투자 이론(CAPM, Fama-French 3-Factor, Momentum, Mean Reversion, Efficient Frontier, Risk Metrics, MA Crossover, Volatility Regime)을 선택해 동시에 비교합니다.
- 각 이론은 개념 요약, 핵심 수치, 그래프, Why 설명, What-if 슬라이더로 구성됩니다.
- 같은 가격 데이터라도 모델과 가정에 따라 해석이 달라진다는 핵심 메시지를 체험합니다.
- 이 앱은 예측 도구가 아니라, 이론을 실험하고 이해하기 위한 교육용 시뮬레이션입니다.

## How we built it (어떻게 만들었는가)
- Frontend: 단일 페이지 UI(HTML + Tailwind CDN + Chart.js)로 카드 기반 레이아웃을 구성
- Backend: Node.js 최소 HTTP 서버로 Alpha Vantage API를 프록시하여 CORS 문제를 해결
- Data pipeline: API 응답을 {t, o, h, l, c, v} 표준 스키마로 정규화하고, 기간에 따라 일/주 데이터를 자동 선택
- Interaction: 비교 테이블, 실시간 슬라이더 업데이트, 동적 차트 렌더링을 구현

프로젝트 진행과정은 다음과 같습니다.
- 1단계: 단일 HTML 구조로 빠르게 프로토타이핑
- 2단계: 브라우저 직접 호출에서 CORS와 API 키 노출 문제 발견
- 3단계: Node.js 프록시 서버 도입 및 .env 기반 키 관리로 전환
- 4단계: 계산 로직과 렌더링을 모듈로 분리해 유지보수성과 확장성을 확보
- 5단계: 프리미엄 엔드포인트 이슈 해결을 위해 무료 엔드포인트 폴백, 캐시, 스로틀 적용
- 6단계: 반응형 차트 오버플로우 해결 및 설명 품질 강화

## Challenges we ran into (어려움과 해결)
- API 제한: 프리미엄 엔드포인트와 레이트리밋 문제를 무료 엔드포인트 폴백 + 캐시/스로틀로 해결
- 데이터 정렬: 서로 다른 ETF와 주식의 거래일 불일치를 날짜 정렬 로직으로 해결
- 반응형 차트: 다양한 화면 비율에서 캔버스가 넘치는 문제를 컨테이너 고정 및 Chart.js 옵션 재정의로 해결
- 설명 품질: 이론 가정 -> 데이터 특징 -> 결과 해석 구조로 재작성

## Accomplishments that we're proud of (자랑할 점)
- 8개 이론을 모두 구현하고, 각 이론의 핵심 수치/그래프/설명을 일관된 카드 구조로 통합
- 실시간 데이터 기반 이론 시뮬레이션과 What-if 컨트롤을 동시 제공
- 비교 테이블로 결과를 한눈에 정리하여 학습 경험을 강화
- 단일 페이지에서 전체 학습 흐름이 완결되는 실험실형 UI 완성

## What we learned (배운 점)
- 관측 구간과 가정이 바뀌면 결과가 크게 달라진다는 점을 실험적으로 확인
- UI에서 설명 구조와 시각화가 학습 효과를 크게 좌우한다는 점을 학습
- 실제 데이터를 다루는 프로젝트에서는 API 비용/제한과 캐시 전략이 핵심임을 이해

## Personal reflection (나를 돌아본 점)
- 이론 구현 자체보다 사용자가 이해하는 흐름을 설계하는 것이 더 어렵다는 점을 체감했습니다.
- 데이터, 수식, UX를 동시에 다뤄야 하므로 설명의 명료함과 설득력이 중요함을 배웠습니다.

## Math reference (LaTeX)
로그 수익률:

$$
r_t = \ln\left(\frac{P_t}{P_{t-1}}\right)
$$

로그 수익률을 단순 수익률로 변환:

$$
R_t = e^{r_t} - 1
$$

연율화 기대수익률:

$$
\bar{r}_{ann} = \bar{r} \cdot N
$$

연율화 변동성:

$$
\sigma_{ann} = \sqrt{\frac{1}{n-1}\sum_{t=1}^{n}(r_t-\bar{r})^2}\cdot\sqrt{N}
$$

롤링 변동성(윈도우 w):

$$
\sigma_t = \sqrt{\frac{1}{w}\sum_{i=t-w+1}^{t}(r_i-\bar{r}_w)^2}\cdot\sqrt{N}
$$

이동평균과 표준편차:

$$
MA_t = \frac{1}{w}\sum_{i=t-w+1}^{t}P_i,\quad SD_t = \sqrt{\frac{1}{w}\sum_{i=t-w+1}^{t}(P_i-MA_t)^2}
$$

Z-Score:

$$
z_t = \frac{P_t - MA_t}{SD_t}
$$

가격 기반 누적 곡선:

$$
E_t = E_{t-1}\cdot\frac{P_t}{P_{t-1}}
$$

전략 누적 곡선(신호 s_t):

$$
E_t = E_{t-1}\cdot\left(1 + s_t\cdot (e^{r_t}-1)\right)
$$

드로다운:

$$
DD_t = \frac{E_t - \max_{\tau\le t}E_\tau}{\max_{\tau\le t}E_\tau}
$$

CAPM:

$$
E[R_i] = R_f + \beta_i\,(E[R_m]-R_f)
$$

베타:

$$
\beta_i = \frac{\mathrm{Cov}(r_i,r_m)}{\mathrm{Var}(r_m)}
$$

Fama-French 3-Factor:

$$
r_i = \alpha + \beta_{mkt} r_m + \beta_{smb} SMB + \beta_{hml} HML + \epsilon
$$

$$
SMB = r_{small}-r_{mkt},\quad HML = r_{value}-r_{mkt}
$$

결정계수:

$$
R^2 = 1 - \frac{\sum_t (y_t-\hat{y}_t)^2}{\sum_t (y_t-\bar{y})^2}
$$

모멘텀 신호:

$$
s_t = \begin{cases}1 & \frac{P_t}{P_{t-L}}-1 > 0\\\\0 & \text{otherwise}\end{cases}
$$

평균회귀 신호:

$$
s_t = \begin{cases}1 & z_t \le -k\\\\0 & z_t \ge 0\end{cases}
$$

이동평균 크로스오버:

$$
s_t = \begin{cases}1 & MA^{short}_t > MA^{long}_t\\\\0 & \text{otherwise}\end{cases}
$$

변동성 레짐 신호:

$$
s_t = \begin{cases}1 & \sigma_t \le \tau\\\\0 & \text{otherwise}\end{cases}
$$

평균-분산 포트폴리오:

$$
\mu_p = w^\top \mu,\quad \sigma_p^2 = w^\top \Sigma w,\quad U = \mu_p - \frac{\lambda}{2}\sigma_p^2
$$

## One-line summary (한 줄 요약)
예측이 아니라 이론의 가정과 민감도를 실제 데이터로 체험하는 금융 학습 실험실을 만들었습니다.

## What's next for Interactive Stock Theory Lab (다음 단계)
- 더 많은 요인 데이터와 ETF를 추가해 이론의 다양성과 신뢰도를 높일 예정
- 사용자 맞춤형 포트폴리오와 리밸런싱 전략을 확장
- 결과 공유, 리포트 다운로드, 학습 노트 기능 추가
- 한국어 UI 버전과 교육 커리큘럼 모듈 제공
