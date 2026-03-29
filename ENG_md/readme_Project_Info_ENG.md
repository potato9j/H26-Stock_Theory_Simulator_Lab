# Interactive Stock Theory Lab (Hackonomics 2026)

## 1) Project Overview
`Interactive Stock Theory Lab` is an educational web application that helps users learn finance theories using overseas stock market data.  
Its core purpose is not stock price prediction, but showing that even with the same real data, interpretations can differ depending on theory, assumptions, and model structure.

Users enter a ticker, select theories, and run the analysis. The app then provides theory-specific result cards (key metrics + charts + explanations + what-if controls) for comparative learning.

## 2) Purpose
- Reduce learning barriers that occur when financial engineering is studied only through formulas
- Provide an intuitive learning experience by linking real market data to finance theories
- Build an educational lab that systematically demonstrates assumptions and model limits, not investment recommendations

## 3) Key Features
- Ticker-based overseas stock price retrieval (via Alpha Vantage)
- Time range selection: `1M / 6M / 1Y / 3Y / 5Y / Custom`
- Batch execution after theory selection
- Automatic generation of theory result cards
  - Theory Overview
  - Key Outputs (KPI)
  - Charts
  - Why this happened
  - What-if controls (updated instantly with sliders)
- Cross-theory comparison table for core metrics
- Responsive UI (desktop/mobile)

## 4) Implemented Theories (8)
1. CAPM
2. Fama-French 3-Factor
3. Momentum Strategy
4. Mean Reversion Strategy
5. Efficient Frontier (Mean-Variance)
6. Risk Metrics Dashboard
7. Moving Average Crossover
8. Volatility Regime Risk Control

## 5) Tech Stack
- Frontend: `HTML`, `CSS`, `JavaScript`, `Tailwind CSS (CDN)`, `Chart.js`
- Backend: `Node.js` (built-in `http` server)
- Data API: `Alpha Vantage`
- Secret management: `.env`

## 6) How to Run (Local)
### Prerequisites
- Install Node.js
- Get an Alpha Vantage API key

### Environment Variables
Set the following in the `.env` file at the project root:

```env
ALPHA_VANTAGE_KEY=YOUR_API_KEY
PORT=3000
```

### Start Server
```powershell
cd ------
node server.js
```

### Open in Browser
```text
------ (local dev. environ. only.)
```

## 7) How to Use
1. Enter a ticker (e.g., `AAPL`, `MSFT`, `NVDA`, `SPY`)
2. Select a time range
3. Select theory checkboxes
4. Click `Run`
5. Review the comparison table and theory cards in the results area
6. Adjust assumptions with sliders and observe output changes

## 8) What Results You Get
- Theory-specific key metrics (e.g., beta, required return, drawdown, strategy return)
- Price/strategy/risk charts
- Structured interpretation text linking data features to theory outputs (`Why this happened`)
- Sensitivity outcomes showing how conclusions change when assumptions change

## 9) Project Structure (Summary)
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
├─ .env            (private)
├─ .env.example
├─ DISCLAIMER.md
├─ PRIVACY.md
├─ Project Story.md
├─ Project Story.ko.md
└─ readme.md
```

## 10) Limitations and Notes
- Free API plan limits may cause request throttling or response delays
- Data fetches may fail depending on provider/API status
- This service is for education only and does not provide investment advice

For legal details, see:
- `DISCLAIMER.md`
- `PRIVACY.md`

## 11) License
This project is released under the `MIT License`.  
(See `LICENSE`)
