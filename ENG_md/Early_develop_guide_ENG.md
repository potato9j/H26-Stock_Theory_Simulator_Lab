# Early Develop guide KOR

- present md file ver. : 1.0.0
- tentative name : Stock Theory Simulator Lab / Interactive Stock Theory Lab
- overview : Web/App Design for Hackonomics Entries

| date | ver. |
|---|---|
|25/01/06|1.0.0|


---

### GOAL

- The goal is not "investment forecasting", but to create an interactive web app for financial and economic literacy education that uses actual overseas stock price data to **directly simulate and learn** various asset price/stock theories.
- The user ticks the theory and presses the run button to simultaneously check the results (graphs/core figures) and easy explanations (step by step, very clear) for each selected theory.
- **What-if slider is key, which experiences a change in the results** if you change the assumption (parameter).

---

### Important Principle

- Theories such as CAPM are implemented by calculating and interpreting "expected returns/required returns/risk/assuming/sensitivity" rather than "short-term directional prediction".
- Message in the app: Even with the same data, the conclusion is different if the theory/assumption is different. Users learn this by manipulation/experience.
- Since the submission is a 1-2 minute demo video, **Select→Execute→Results** should be strongly revealed without changing the screen.

---

### Data Set

- Enter or search for overseas stock tickers (e.g. AAPL, MSFT, SPY, etc.).
- Minimum MVP: Sample data (JSON/CSV) may be embedded.
- If possible, avoid using sample data (JSON).
- Extensions: Only structures should be open (not required) for real data to be imported into crawling/external APIs.
- Mandatory Data: Daily closing price (dividend/division adjusted closing price if possible), date.
  
<br>

- last updated : 26-01-13
- not using JSON and CSV (only using real market data base on API)
  
---

### Main User Flow (UX)

1) Landing / Setup 화면
 - Ticker input (overseas stocks)
 - Select period (e.g. 1Y/3Y/5Y/custom)
 - Select theory check box list (multiple choices available)
 - Mouse over to the checkbox and one or two line tooltips (simply "what the theory calculates")
 - "Run / Run" button

<br>

2) Results screen (or expand down from the same page)
 - 'Card (Section)' is generated for each selected theory
 - Configure each theory card (fixed):
    - A. Easy explanation (what does this theory calculate / what assumptions are made / meaning of output)
    - B. Three key figures (defined by theory)
    - C. Graphs 1 to 2 (defined by theory)
    - D. What-if Sliders 1 or 2 (domestic change → instant graph/numerical update)
    - Common Summary Bar at the top:
 - **If the theory/assumption of choice is different, the conclusion will be different** in one line,
 - Compare the core results of each theory in tabular form (if possible).
    
---

### Investment Theory to Implement (min 6, max 7~8)
- Implementing the following theories as "educational simulations".
- Each theory should show 'model output + interpretation' rather than 'prediction'.
  
<br>

1) CAPM (required)
- Calculations: Beta (β) estimation, required return E[Ri], SML (if possible)
- Input/hypothesis slider: Risk-free return Rf, market risk premium (E[Rm]-Rf)
- Graph: (a) stock point display on SML or (b) change in β estimation over time
- Key numerical examples: β, required rate of return, past realized rate of return (for comparison)

<br>

2) Fama-French 요인모형(가능하면 3-factor 또는 단순화)
- 산출: 요인노출 계수, 기대수익(또는 설명력)
- 슬라이더/선택: 추정 기간, 요인 버전(3-factor vs market-only)
- 그래프: 요인 기여도(막대) 또는 예측(설명) 수익률 vs 실현수익률(교육용)

<br>

3) Momentum Strategy Simulator (Experiential Rule)
- Output: Lookback Period-Based Signals, Strategy Accumulated Earnings vs Buy&Hold, Max Drop
- Sliders: Lookback period (e.g., 3/6/12 months), rebalancing cycle
- Graph: Strategic Value Curve vs Benchmark

<br>

4) Mean Reversion Signal Simulator
- Output: z-score/difference-based signal, strategic performance vs Buy&Hold
- Sliders: average duration of movement, entry threshold (z)
- Graph: price and mean line + signal interval display, strategic value curve

<br>

5) Risk Metrics Dashboard (required)
- Calculations: Volatility, Maximum Drop (MDD), Recovery Period, (Optional) VaR
- Slider: the rolling window
- Graph: Drawdown Chart + Heatmap (selected)

<br>

6) Efficient Frontier / Mean-Variance (if possible)
- Multi-asset portfolio (provides presets such as ETFs for stocks + SPY + bonds)
- Output: Efficient frontier, minimum variance portfolio, user choice
- Sliders: Hedge (λ) or Target Return
- Graph: Frontiers in Return-Risk Space

<br>

7) DCF "Discount Rate Sensitivity" Mini Lab (Price Rating Perspective)
- Input: Growth rate g, discount rate r (user slider)
- Output: Theoretical Value Change (Sensitivity Chart)
- However, the actual stock price and consolidation are for "home change → value change" education only.

---

### Early Design Set

- iOS-feeling Round Card/Burton, Responsive, Very Clean UI
- Dark Mode Based: Black to Navy Background
- Point Color: Yellow (Emphasis/Select/Burton/Highlight)
- Important UX:
    - Checkbox hover tool tip (simple description)
    - After execution, extend the same to "Detailed and Easy Description + Graph"

---

### Initial Estimated Output

1) Screen IA (Information Structure) + Component List
2) **Explanatory text for each theory (for first time)** Draft (short and clear)
3) Defining outputs for each theory (3 core values + 1 to 2 graphs + 1 to 2 sliders)
4) Determine MVP range (first things to implement)
5) Development folder structure and key function signature design (if possible)
6) Storyboard for demo video (1 or 2 minutes): Which scenes will be shown in order

---

### Caution

- Prohibits performance claims such as future directional 95% prediction (related to past ED5 models)
- No investment solicitation/return guarantee form.
- The purpose of spreading education/awareness is clear.
