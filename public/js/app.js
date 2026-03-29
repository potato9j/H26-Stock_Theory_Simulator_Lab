import { fetchPriceSeries } from "./api.js";
import {
  sliceByRange,
  toLogReturns,
  alignReturns,
  alignReturnsMap,
  calcBeta,
  calcAnnualizedReturn,
  calcVolatility,
  calcRollingVolatility,
  calcMaxDrawdownFromEquity,
  buildEquityCurve,
  buildEquityFromReturns,
  buildDrawdownSeries,
  calcRecoveryTime,
  calcMovingAverage,
  calcZScoreSeries,
  simulateMomentum,
  simulateMeanReversion,
  simulateCrossover,
  simulateVolRegime,
  buildFactorSeries,
  alignAssetFactors,
  calcMultiFactorRegression,
  buildCumulativeFromReturns,
  calcMeanVector,
  calcCovMatrix,
  sampleWeights,
  portfolioStats,
  formatDateLabel,
  formatPercent,
  formatNumber,
  countSignalChanges
} from "./compute.js";
import {
  renderComparisonTable,
  renderTheoryCard,
  renderCapmCharts,
  renderFfCharts,
  renderMomentumCharts,
  renderMeanRevCharts,
  renderFrontierCharts,
  renderRiskCharts,
  renderCrossoverCharts,
  renderVolRegimeCharts
} from "./render.js";

// 한국어 주석: UI 상태 및 데이터 캐시
const APP = {
  range: "1Y",
  seriesCache: new Map(),
  lastRun: null
};

const THEORY_DEFS = [
  { id: "capm", label: "CAPM", tip: "Required return based on market sensitivity (beta)." },
  { id: "ff3", label: "Fama-French 3-Factor", tip: "Adds size/value factors to explain returns." },
  { id: "momentum", label: "Momentum Strategy", tip: "Follows recent trends rather than predicting them." },
  { id: "meanrev", label: "Mean Reversion Strategy", tip: "Buys dips and sells pops toward the average." },
  { id: "frontier", label: "Efficient Frontier", tip: "Risk-return tradeoff across a small basket." },
  { id: "risk", label: "Risk Metrics Dashboard", tip: "Volatility, drawdowns, and recovery time." },
  { id: "crossover", label: "MA Crossover", tip: "Trend-following via moving averages." },
  { id: "volregime", label: "Volatility Regime Control", tip: "Reduce exposure in high-volatility regimes." }
];

function getIntervalMeta(interval) {
  if (interval === "weekly") return { periodsPerYear: 52, unit: "weeks" };
  if (interval === "monthly") return { periodsPerYear: 12, unit: "months" };
  return { periodsPerYear: 252, unit: "days" };
}

function scaleWindow(baseDays, periodsPerYear, minValue = 2) {
  const scaled = Math.round((baseDays * periodsPerYear) / 252);
  return Math.max(minValue, scaled);
}

function scaleStep(baseStep, periodsPerYear) {
  return Math.max(1, Math.round((baseStep * periodsPerYear) / 252));
}

function getRebalanceOptions(interval) {
  if (interval === "weekly") {
    return [
      { step: 1, periods: 1, label: "Weekly (1w)" },
      { step: 2, periods: 4, label: "Monthly (4w)" },
      { step: 3, periods: 13, label: "Quarterly (13w)" }
    ];
  }
  if (interval === "monthly") {
    return [
      { step: 1, periods: 1, label: "Monthly (1m)" },
      { step: 2, periods: 3, label: "Quarterly (3m)" },
      { step: 3, periods: 6, label: "Semiannual (6m)" }
    ];
  }
  return [
    { step: 1, periods: 5, label: "Weekly (5d)" },
    { step: 2, periods: 21, label: "Monthly (21d)" },
    { step: 3, periods: 63, label: "Quarterly (63d)" }
  ];
}

const theoryList = document.getElementById("theoryList");
const customStart = document.getElementById("customStart");
const customEnd = document.getElementById("customEnd");
const errorBox = document.getElementById("errorBox");
const resultsSection = document.getElementById("results");

// 체크박스 UI 생성
THEORY_DEFS.forEach((t) => {
  const wrap = document.createElement("label");
  wrap.className = "flex items-center gap-2 tooltip whitespace-nowrap min-w-0";
  wrap.setAttribute("data-tip", t.tip);
  wrap.innerHTML = `<input type="checkbox" data-theory="${t.id}" class="accent"/>
                    <span class="truncate">${t.label}</span>`;
  theoryList.appendChild(wrap);
});

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.add("hidden");
}

function setLoading(isLoading) {
  const btn = document.getElementById("runBtn");
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Loading..." : "Run";
  btn.classList.toggle("opacity-70", isLoading);
}

function updateKpi(theoryId, kpiId, value) {
  const node = document.querySelector(`[data-kpi='${theoryId}-${kpiId}']`);
  if (node) node.textContent = value;
}

function updateCompare(theoryId, index, value) {
  const node = document.querySelector(`[data-compare-kpi='${theoryId}-${index}']`);
  if (node) node.textContent = value;
}

function updateWhy(theoryId, text) {
  const node = document.getElementById(`${theoryId}-why`);
  if (node) node.textContent = text;
}

function updateTakeaway(theoryId, text) {
  const node = document.getElementById(`${theoryId}-takeaway`);
  if (node) node.textContent = text;
}

async function getSeries(symbol) {
  const upper = symbol.toUpperCase();
  const cacheKey = `${upper}:${APP.range}:${customStart.value || ""}:${customEnd.value || ""}`;
  if (APP.seriesCache.has(cacheKey)) return APP.seriesCache.get(cacheKey);
  const payload = await fetchPriceSeries(upper, APP.range, customStart.value, customEnd.value);
  APP.seriesCache.set(cacheKey, payload);
  return payload;
}

function collectSymbols(selected, ticker) {
  const symbols = new Set([ticker]);
  const needsMarket = selected.some((id) => ["capm", "ff3", "frontier"].includes(id));
  if (needsMarket) symbols.add("SPY");
  if (selected.includes("ff3")) {
    symbols.add("IWM");
    symbols.add("VTV");
  }
  if (selected.includes("frontier")) {
    symbols.add("TLT");
  }
  return [...symbols];
}

async function loadSeries(symbols) {
  const seriesMap = {};
  const returnsMap = {};
  let interval = null;
  for (const symbol of symbols) {
    const payload = await getSeries(symbol);
    if (!interval) interval = payload.interval;
    if (payload.interval !== interval) {
      throw new Error("Mixed data intervals detected. Please try again.");
    }
    const filtered = sliceByRange(payload.series, APP.range, customStart.value, customEnd.value);
    if (filtered.length < 2) {
      throw new Error(`Not enough data for ${symbol} in the selected period.`);
    }
    seriesMap[symbol] = filtered;
    returnsMap[symbol] = toLogReturns(filtered);
  }
  return { seriesMap, returnsMap, interval: interval || "daily" };
}

function toLabelArray(points) {
  return points.map((p) => formatDateLabel(p.t));
}

function seriesToValues(series) {
  return series.map((p) => p.c);
}

function alignToReturns(series) {
  return series.slice(1);
}

function calcCorrelation(seriesA, seriesB) {
  const aligned = alignReturnsMap({ a: seriesA, b: seriesB });
  if (aligned.length < 2) return NaN;
  const meanA = aligned.reduce((s, r) => s + r.a, 0) / aligned.length;
  const meanB = aligned.reduce((s, r) => s + r.b, 0) / aligned.length;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (const row of aligned) {
    cov += (row.a - meanA) * (row.b - meanB);
    varA += (row.a - meanA) ** 2;
    varB += (row.b - meanB) ** 2;
  }
  return cov / Math.sqrt(varA * varB);
}

function buildCapm(state) {
  const assetSeries = state.series[state.ticker];
  const marketSeries = state.series.SPY;
  const assetReturns = state.returns[state.ticker];
  const marketReturns = state.returns.SPY;

  const pairs = alignReturns(assetReturns, marketReturns);
  const { beta } = calcBeta(pairs);
  const assetAnnualReturn = calcAnnualizedReturn(assetReturns, state.periodsPerYear);
  const corr = calcCorrelation(assetReturns, marketReturns);
  const assetCurve = buildEquityCurve(assetSeries);
  const marketCurve = buildEquityCurve(marketSeries);
  const labels = toLabelArray(assetCurve);

  const capmParams = { rf: 0.03, mrp: 0.05 };
  const requiredReturn = capmParams.rf + beta * capmParams.mrp;
  const alpha = assetAnnualReturn - requiredReturn;

  const corrText = Number.isFinite(corr) ? formatNumber(corr, 2) : "N/A";
  const sensitivity = beta > 1.1 ? "amplify" : beta < 0.9 ? "dampen" : "track";
  const why = `Recent returns show a ${corrText} correlation with the market, so market moves tend to ${sensitivity} the asset's moves. With beta ${formatNumber(beta, 2)}, CAPM sets a required return of ${formatPercent(requiredReturn)} versus a realized ${formatPercent(assetAnnualReturn)}.`;

  const card = {
    id: "capm",
    title: "CAPM",
    overview: `<div class="space-y-1">
      <div><span class="text-gray-400">What it does:</span> Estimates a required return from market beta.</div>
      <div><span class="text-gray-400">Key assumption:</span> Only market-wide risk is rewarded; diversifiable risk is not priced.</div>
      <div><span class="text-gray-400">Applied here:</span> Compare ${state.ticker} with SPY to infer beta.</div>
    </div>`,
    kpis: [
      { id: "beta", label: "Beta (beta)", value: formatNumber(beta, 2) },
      { id: "req", label: "Required Return", value: formatPercent(requiredReturn) },
      { id: "alpha", label: "Jensen Alpha", value: formatPercent(alpha) }
    ],
    charts: [{ id: "capmScatter" }, { id: "capmCurve" }],
    why,
    takeaway: "Changing beta or the market premium shifts the required return even if the price path looks similar.",
    controls: [
      { id: "capm-rf", label: "Risk-free rate", min: 0, max: 0.08, step: 0.001, value: capmParams.rf, display: formatPercent(capmParams.rf) },
      { id: "capm-mrp", label: "Market risk premium", min: 0.01, max: 0.12, step: 0.005, value: capmParams.mrp, display: formatPercent(capmParams.mrp) }
    ]
  };

  const tableRow = { id: "capm", title: "CAPM", kpis: [card.kpis[0].value, card.kpis[1].value, card.kpis[2].value] };

  function attach(container) {
    const rfInput = container.querySelector("[data-control='capm-rf']");
    const mrpInput = container.querySelector("[data-control='capm-mrp']");
    if (!rfInput || !mrpInput) return;

    const update = () => {
      const rf = Number(rfInput.value);
      const mrp = Number(mrpInput.value);
      const req = rf + beta * mrp;
      const newAlpha = assetAnnualReturn - req;

      updateKpi("capm", "req", formatPercent(req));
      updateKpi("capm", "alpha", formatPercent(newAlpha));
      updateCompare("capm", 1, formatPercent(req));
      updateCompare("capm", 2, formatPercent(newAlpha));
      document.getElementById("capm-rf-val").textContent = formatPercent(rf);
      document.getElementById("capm-mrp-val").textContent = formatPercent(mrp);
      updateWhy("capm", `Recent correlation with the market is ${corrText}, so beta ${formatNumber(beta, 2)} drives the required return. With the chosen inputs, the required return is ${formatPercent(req)} versus a realized ${formatPercent(assetAnnualReturn)}.`);
    };

    rfInput.addEventListener("input", update);
    mrpInput.addEventListener("input", update);
  }

  return {
    card,
    tableRow,
    render: () => renderCapmCharts({ pairs, assetCurve, marketCurve, labels }),
    attach
  };
}
function computeFfState(aligned, windowDays, useThree, periodsPerYear) {
  const windowed = aligned.slice(-windowDays);
  if (windowed.length < 5) {
    return {
      alpha: NaN,
      betas: [NaN, NaN, NaN],
      r2: NaN,
      modelAnnual: NaN,
      actualCurve: [],
      modelCurve: [],
      labels: [],
      loadings: [0, 0, 0]
    };
  }

  const regression = calcMultiFactorRegression(windowed, useThree);
  const betaMkt = regression.betas[0] ?? NaN;
  const betaSmb = useThree ? regression.betas[1] ?? 0 : 0;
  const betaHml = useThree ? regression.betas[2] ?? 0 : 0;

  const meanMkt = windowed.reduce((s, o) => s + o.mkt, 0) / windowed.length;
  const meanSmb = windowed.reduce((s, o) => s + o.smb, 0) / windowed.length;
  const meanHml = windowed.reduce((s, o) => s + o.hml, 0) / windowed.length;

  const modelDaily = regression.alpha + betaMkt * meanMkt + betaSmb * meanSmb + betaHml * meanHml;
  const modelAnnual = modelDaily * periodsPerYear;

  const actualReturns = windowed.map((o) => ({ t: o.t, r: o.ar }));
  const modelReturns = windowed.map((o, i) => ({ t: o.t, r: regression.predicted[i] ?? 0 }));
  const actualCurve = buildCumulativeFromReturns(actualReturns);
  const modelCurve = buildCumulativeFromReturns(modelReturns);
  const labels = toLabelArray(actualCurve);
  const loadings = [betaMkt, betaSmb, betaHml];

  return {
    alpha: regression.alpha,
    betas: [betaMkt, betaSmb, betaHml],
    r2: regression.r2,
    modelAnnual,
    actualCurve,
    modelCurve,
    labels,
    loadings
  };
}

function buildFf(state) {
  const assetReturns = state.returns[state.ticker];
  const marketReturns = state.returns.SPY;
  const sizeReturns = state.returns.IWM;
  const valueReturns = state.returns.VTV;
  const assetAnnualReturn = calcAnnualizedReturn(assetReturns, state.periodsPerYear);

  const factorSeries = buildFactorSeries(marketReturns, sizeReturns, valueReturns);
  const aligned = alignAssetFactors(assetReturns, factorSeries);

  const defaultMonths = 12;
  const defaultFactorStep = 2;
  const periodsPerMonth = state.periodsPerYear / 12;
  const windowDays = Math.min(aligned.length, Math.round(defaultMonths * periodsPerMonth));
  const useThree = defaultFactorStep === 2;

  let ffState = computeFfState(aligned, windowDays, useThree, state.periodsPerYear);
  const dominant = useThree
    ? ["Market", "Size", "Value"][
        [Math.abs(ffState.betas[0]), Math.abs(ffState.betas[1]), Math.abs(ffState.betas[2])].indexOf(
          Math.max(Math.abs(ffState.betas[0]), Math.abs(ffState.betas[1]), Math.abs(ffState.betas[2]))
        )
      ]
    : "Market";
  const fitDesc = ffState.r2 >= 0.5 ? "captures a large share" : "explains only a modest part";
  const gap = assetAnnualReturn - ffState.modelAnnual;
  const gapDesc = Math.abs(gap) < 0.01 ? "close to" : gap > 0 ? "higher than" : "lower than";
  const why = `The model ${fitDesc} of return variation and loads most on ${dominant}. The implied return is ${formatPercent(ffState.modelAnnual)}, which is ${gapDesc} the realized ${formatPercent(assetAnnualReturn)}.`;

  const card = {
    id: "ff3",
    title: "Fama-French 3-Factor",
    overview: `<div class="space-y-1">
      <div><span class="text-gray-400">What it does:</span> Extends CAPM with size (SMB) and value (HML) factors.</div>
      <div><span class="text-gray-400">Key assumption:</span> Size/value exposures help explain returns beyond the market.</div>
      <div><span class="text-gray-400">Applied here:</span> Use SPY, IWM, and VTV as factor proxies.</div>
    </div>`,
    kpis: [
      { id: "model", label: "Model Implied Return", value: formatPercent(ffState.modelAnnual) },
      { id: "r2", label: "R-squared", value: formatNumber(ffState.r2, 2) },
      { id: "mkt", label: "Market Beta", value: formatNumber(ffState.betas[0], 2) }
    ],
    charts: [{ id: "ffLoadings" }, { id: "ffFit" }],
    why,
    takeaway: "Changing the factor set or window alters the story even with the same prices.",
    controls: [
      { id: "ff-window", label: "Estimation window (months)", min: 3, max: 36, step: 1, value: defaultMonths, display: `${defaultMonths} months` },
      { id: "ff-factors", label: "Factor set", min: 1, max: 2, step: 1, value: defaultFactorStep, display: "Three-factor" }
    ]
  };

  const tableRow = { id: "ff3", title: "Fama-French", kpis: [card.kpis[0].value, card.kpis[1].value, card.kpis[2].value] };

  function renderCharts() {
    renderFfCharts({
      loadings: ffState.loadings,
      labels: ffState.labels,
      actualCurve: ffState.actualCurve,
      modelCurve: ffState.modelCurve
    });
  }

  function attach(container) {
    const windowInput = container.querySelector("[data-control='ff-window']");
    const factorInput = container.querySelector("[data-control='ff-factors']");
    if (!windowInput || !factorInput) return;

    const update = () => {
      const months = Number(windowInput.value);
      const factorStep = Number(factorInput.value);
      const useThreeFactors = factorStep === 2;
      const days = Math.min(aligned.length, Math.round(months * periodsPerMonth));

      ffState = computeFfState(aligned, days, useThreeFactors, state.periodsPerYear);

      const localDominant = useThreeFactors
        ? ["Market", "Size", "Value"][
            [Math.abs(ffState.betas[0]), Math.abs(ffState.betas[1]), Math.abs(ffState.betas[2])].indexOf(
              Math.max(Math.abs(ffState.betas[0]), Math.abs(ffState.betas[1]), Math.abs(ffState.betas[2]))
            )
          ]
        : "Market";
      const localFit = ffState.r2 >= 0.5 ? "captures a large share" : "explains only a modest part";
      const localGap = assetAnnualReturn - ffState.modelAnnual;
      const localGapDesc = Math.abs(localGap) < 0.01 ? "close to" : localGap > 0 ? "higher than" : "lower than";
      updateWhy("ff3", `The model ${localFit} of return variation and loads most on ${localDominant}. The implied return is ${formatPercent(ffState.modelAnnual)}, which is ${localGapDesc} the realized ${formatPercent(assetAnnualReturn)}.`);

      updateKpi("ff3", "model", formatPercent(ffState.modelAnnual));
      updateKpi("ff3", "r2", formatNumber(ffState.r2, 2));
      updateKpi("ff3", "mkt", formatNumber(ffState.betas[0], 2));
      updateCompare("ff3", 0, formatPercent(ffState.modelAnnual));
      updateCompare("ff3", 1, formatNumber(ffState.r2, 2));
      updateCompare("ff3", 2, formatNumber(ffState.betas[0], 2));

      document.getElementById("ff-window-val").textContent = `${months} months`;
      document.getElementById("ff-factors-val").textContent = useThreeFactors ? "Three-factor" : "Market-only";

      renderCharts();
    };

    windowInput.addEventListener("input", update);
    factorInput.addEventListener("input", update);
  }

  return { card, tableRow, render: renderCharts, attach };
}

function computeMomentumState(series, returns, lookback, rebalanceDays) {
  const sim = simulateMomentum(series, returns, lookback, rebalanceDays);
  const equityCurve = sim.equityCurve;
  const buyHoldCurve = buildEquityCurve(series).slice(1);
  const totalReturn = equityCurve.length ? equityCurve[equityCurve.length - 1].value - 1 : NaN;
  const maxDD = calcMaxDrawdownFromEquity(equityCurve);
  const tradeCount = countSignalChanges(sim.signals);
  const lookbackReturn = series.length > lookback ? series[series.length - 1].c / series[series.length - 1 - lookback].c - 1 : NaN;
  const signal = sim.signals.length ? sim.signals[sim.signals.length - 1].s : 0;
  const labels = toLabelArray(equityCurve);

  return {
    equityCurve,
    buyHoldCurve,
    signals: sim.signals,
    totalReturn,
    maxDD,
    tradeCount,
    lookbackReturn,
    signal,
    labels
  };
}

function buildMomentum(state) {
  const series = state.series[state.ticker];
  const returns = state.returns[state.ticker];
  const defaultLookback = scaleWindow(60, state.periodsPerYear, 5);
  const minLookback = scaleWindow(20, state.periodsPerYear, 3);
  const maxLookback = scaleWindow(252, state.periodsPerYear, 20);
  const stepLookback = scaleStep(5, state.periodsPerYear);
  const rebalanceOptions = getRebalanceOptions(state.interval);
  const defaultRebalanceStep = 2;
  const rebalance = rebalanceOptions[defaultRebalanceStep - 1];

  let momentumState = computeMomentumState(series, returns, defaultLookback, rebalance.periods);
  const lookbackText = Number.isFinite(momentumState.lookbackReturn) ? formatPercent(momentumState.lookbackReturn) : "N/A";
  const signalText = momentumState.signal === 1 ? "Long" : "Cash";
  const regime = momentumState.tradeCount > 6 ? "choppy" : "trending";
  const why = `Over the last ${defaultLookback} ${state.unitLabel}, return is ${lookbackText}, so the signal is ${signalText.toLowerCase()}. The window looks ${regime} with ${momentumState.tradeCount} signal changes.`;

  const card = {
    id: "momentum",
    title: "Momentum Strategy",
    overview: `<div class="space-y-1">
      <div><span class="text-gray-400">What it does:</span> Holds the asset when its lookback return is positive.</div>
      <div><span class="text-gray-400">Key assumption:</span> Trends persist for a while before reversing.</div>
      <div><span class="text-gray-400">Applied here:</span> Signal updates every rebalance step.</div>
    </div>`,
    kpis: [
      { id: "signal", label: "Current Signal", value: signalText },
      { id: "return", label: "Strategy Return", value: formatPercent(momentumState.totalReturn) },
      { id: "mdd", label: "Max Drawdown", value: formatPercent(momentumState.maxDD) }
    ],
    charts: [{ id: "momentumEquity" }, { id: "momentumSignal" }],
    why,
    takeaway: "Trend persistence helps momentum; sharp reversals and choppy markets hurt it.",
    controls: [
      { id: "momentum-lookback", label: `Lookback (${state.unitLabel})`, min: minLookback, max: maxLookback, step: stepLookback, value: defaultLookback, display: `${defaultLookback} ${state.unitLabel}` },
      { id: "momentum-rebalance", label: "Rebalance frequency", min: 1, max: 3, step: 1, value: defaultRebalanceStep, display: rebalance.label }
    ]
  };

  const tableRow = { id: "momentum", title: "Momentum", kpis: [card.kpis[0].value, card.kpis[1].value, card.kpis[2].value] };

  function renderCharts() {
    renderMomentumCharts({
      labels: momentumState.labels,
      strategyCurve: momentumState.equityCurve,
      buyHoldCurve: momentumState.buyHoldCurve,
      signalSeries: momentumState.signals
    });
  }

  function attach(container) {
    const lookbackInput = container.querySelector("[data-control='momentum-lookback']");
    const rebalanceInput = container.querySelector("[data-control='momentum-rebalance']");
    if (!lookbackInput || !rebalanceInput) return;

    const update = () => {
      const lookback = Number(lookbackInput.value);
      const rebalanceStep = Number(rebalanceInput.value);
      const rebalanceOption = rebalanceOptions[rebalanceStep - 1] || rebalanceOptions[0];

      momentumState = computeMomentumState(series, returns, lookback, rebalanceOption.periods);
      const lookbackLabel = Number.isFinite(momentumState.lookbackReturn) ? formatPercent(momentumState.lookbackReturn) : "N/A";
      const signalLabel = momentumState.signal === 1 ? "Long" : "Cash";
      const localRegime = momentumState.tradeCount > 6 ? "choppy" : "trending";

      updateKpi("momentum", "signal", signalLabel);
      updateKpi("momentum", "return", formatPercent(momentumState.totalReturn));
      updateKpi("momentum", "mdd", formatPercent(momentumState.maxDD));
      updateCompare("momentum", 0, signalLabel);
      updateCompare("momentum", 1, formatPercent(momentumState.totalReturn));
      updateCompare("momentum", 2, formatPercent(momentumState.maxDD));
      updateWhy("momentum", `Over the last ${lookback} ${state.unitLabel}, return is ${lookbackLabel}, so the signal is ${signalLabel.toLowerCase()}. The window looks ${localRegime} with ${momentumState.tradeCount} signal changes.`);

      document.getElementById("momentum-lookback-val").textContent = `${lookback} ${state.unitLabel}`;
      document.getElementById("momentum-rebalance-val").textContent = rebalanceOption.label;

      renderCharts();
    };

    lookbackInput.addEventListener("input", update);
    rebalanceInput.addEventListener("input", update);
  }

  return { card, tableRow, render: renderCharts, attach };
}
function computeMeanRevState(series, returns, window, threshold) {
  const sim = simulateMeanReversion(series, returns, window, threshold);
  const equityCurve = sim.equityCurve;
  const buyHoldCurve = buildEquityCurve(series).slice(1);
  const totalReturn = equityCurve.length ? equityCurve[equityCurve.length - 1].value - 1 : NaN;
  const maxDD = calcMaxDrawdownFromEquity(equityCurve);
  const lastZ = sim.zscores.length ? sim.zscores[sim.zscores.length - 1].value : null;
  const lastMa = sim.ma.length ? sim.ma[sim.ma.length - 1].value : null;
  const lastPrice = series[series.length - 1].c;
  const deviation = lastMa ? (lastPrice - lastMa) / lastMa : NaN;

  const seriesSlice = alignToReturns(series);
  const maSlice = alignToReturns(sim.ma);
  const stdSlice = alignToReturns(sim.std);
  const priceSeries = seriesToValues(seriesSlice);
  const maSeries = maSlice.map((p) => (p.value === null ? null : p.value));
  const upperBand = maSlice.map((p, i) =>
    p.value === null || stdSlice[i].value === null ? null : p.value + threshold * stdSlice[i].value
  );
  const lowerBand = maSlice.map((p, i) =>
    p.value === null || stdSlice[i].value === null ? null : p.value - threshold * stdSlice[i].value
  );

  return {
    equityCurve,
    buyHoldCurve,
    totalReturn,
    maxDD,
    lastZ,
    deviation,
    priceSeries,
    maSeries,
    upperBand,
    lowerBand,
    labels: toLabelArray(equityCurve)
  };
}

function buildMeanRev(state) {
  const series = state.series[state.ticker];
  const returns = state.returns[state.ticker];
  const defaultWindow = scaleWindow(40, state.periodsPerYear, 5);
  const minWindow = scaleWindow(10, state.periodsPerYear, 3);
  const maxWindow = scaleWindow(120, state.periodsPerYear, 12);
  const stepWindow = scaleStep(5, state.periodsPerYear);
  const defaultThreshold = 1.2;

  let meanRevState = computeMeanRevState(series, returns, defaultWindow, defaultThreshold);
  const status = meanRevState.lastZ !== null && meanRevState.lastZ <= -defaultThreshold
    ? "below"
    : meanRevState.lastZ !== null && meanRevState.lastZ >= defaultThreshold
      ? "above"
      : "near";
  const signalBias = meanRevState.lastZ !== null && meanRevState.lastZ <= -defaultThreshold
    ? "buy/long"
    : meanRevState.lastZ !== null && meanRevState.lastZ >= defaultThreshold
      ? "sell/reduce"
      : "neutral";
  const why = `The price is ${status} its moving average with a z-score of ${formatNumber(meanRevState.lastZ, 2)}. The current bias is ${signalBias} because the entry threshold is ${formatNumber(defaultThreshold, 1)}.`;

  const card = {
    id: "meanrev",
    title: "Mean Reversion Strategy",
    overview: `<div class="space-y-1">
      <div><span class="text-gray-400">What it does:</span> Trades against large deviations from a moving average.</div>
      <div><span class="text-gray-400">Key assumption:</span> Prices overshoot and drift back toward a typical level.</div>
      <div><span class="text-gray-400">Applied here:</span> Z-scores measure how far price is from the average.</div>
    </div>`,
    kpis: [
      { id: "z", label: "Z-Score", value: formatNumber(meanRevState.lastZ, 2) },
      { id: "return", label: "Strategy Return", value: formatPercent(meanRevState.totalReturn) },
      { id: "mdd", label: "Max Drawdown", value: formatPercent(meanRevState.maxDD) }
    ],
    charts: [{ id: "meanrevPrice" }, { id: "meanrevEquity" }],
    why,
    takeaway: "Mean reversion helps after overshoots, but persistent trends can punish it.",
    controls: [
      { id: "meanrev-window", label: `Moving average window (${state.unitLabel})`, min: minWindow, max: maxWindow, step: stepWindow, value: defaultWindow, display: `${defaultWindow} ${state.unitLabel}` },
      { id: "meanrev-threshold", label: "Entry threshold (z)", min: 0.5, max: 2.5, step: 0.1, value: defaultThreshold, display: formatNumber(defaultThreshold, 1) }
    ]
  };

  const tableRow = { id: "meanrev", title: "Mean Reversion", kpis: [card.kpis[0].value, card.kpis[1].value, card.kpis[2].value] };

  function renderCharts() {
    renderMeanRevCharts({
      labels: meanRevState.labels,
      priceSeries: meanRevState.priceSeries,
      maSeries: meanRevState.maSeries,
      upperBand: meanRevState.upperBand,
      lowerBand: meanRevState.lowerBand,
      strategyCurve: meanRevState.equityCurve,
      buyHoldCurve: meanRevState.buyHoldCurve
    });
  }

  function attach(container) {
    const windowInput = container.querySelector("[data-control='meanrev-window']");
    const thresholdInput = container.querySelector("[data-control='meanrev-threshold']");
    if (!windowInput || !thresholdInput) return;

    const update = () => {
      const window = Number(windowInput.value);
      const threshold = Number(thresholdInput.value);

      meanRevState = computeMeanRevState(series, returns, window, threshold);
      const zValue = meanRevState.lastZ;
      const status = zValue !== null && zValue <= -threshold ? "below" : zValue !== null && zValue >= threshold ? "above" : "near";
      const bias = zValue !== null && zValue <= -threshold ? "buy/long" : zValue !== null && zValue >= threshold ? "sell/reduce" : "neutral";

      updateKpi("meanrev", "z", formatNumber(zValue, 2));
      updateKpi("meanrev", "return", formatPercent(meanRevState.totalReturn));
      updateKpi("meanrev", "mdd", formatPercent(meanRevState.maxDD));
      updateCompare("meanrev", 0, formatNumber(zValue, 2));
      updateCompare("meanrev", 1, formatPercent(meanRevState.totalReturn));
      updateCompare("meanrev", 2, formatPercent(meanRevState.maxDD));
      updateWhy("meanrev", `The price is ${status} its moving average with a z-score of ${formatNumber(zValue, 2)}. The current bias is ${bias} because the entry threshold is ${formatNumber(threshold, 1)}.`);

      document.getElementById("meanrev-window-val").textContent = `${window} ${state.unitLabel}`;
      document.getElementById("meanrev-threshold-val").textContent = formatNumber(threshold, 1);

      renderCharts();
    };

    windowInput.addEventListener("input", update);
    thresholdInput.addEventListener("input", update);
  }

  return { card, tableRow, render: renderCharts, attach };
}

function computeFrontierState(returnsMap, ticker, periodsPerYear) {
  const aligned = alignReturnsMap({ asset: returnsMap[ticker], spy: returnsMap.SPY, bond: returnsMap.TLT });
  if (aligned.length < 30) {
    throw new Error("Not enough data for efficient frontier.");
  }
  const matrix = aligned.map((row) => [row.asset, row.spy, row.bond]);
  const meanVec = calcMeanVector(matrix);
  const cov = calcCovMatrix(matrix);
  const samples = sampleWeights(3, 400).map((weights) => {
    const stats = portfolioStats(weights, meanVec, cov);
    return {
      weights,
      mean: stats.mean * periodsPerYear,
      vol: stats.vol * Math.sqrt(periodsPerYear)
    };
  });
  const minVar = samples.reduce((best, item) => (item.vol < best.vol ? item : best), samples[0]);
  return { samples, minVar };
}

function pickByLambda(samples, lambda) {
  return samples.reduce((best, item) => {
    const utility = item.mean - 0.5 * lambda * item.vol * item.vol;
    const bestUtility = best.mean - 0.5 * lambda * best.vol * best.vol;
    return utility > bestUtility ? item : best;
  }, samples[0]);
}

function buildFrontier(state) {
  const frontierState = computeFrontierState(state.returns, state.ticker, state.periodsPerYear);
  const corr = calcCorrelation(state.returns[state.ticker], state.returns.TLT);
  const corrDesc = Number.isFinite(corr)
    ? corr < 0
      ? "negative"
      : corr < 0.3
        ? "low"
        : "positive"
    : "unclear";
  const defaultLambda = 4;
  let selected = pickByLambda(frontierState.samples, defaultLambda);
  const weightText = `${formatPercent(selected.weights[0])} ${state.ticker} / ${formatPercent(selected.weights[1])} SPY / ${formatPercent(selected.weights[2])} TLT`;

  const card = {
    id: "frontier",
    title: "Efficient Frontier",
    overview: `<div class="space-y-1">
      <div><span class="text-gray-400">What it does:</span> Builds mean-variance portfolios from ${state.ticker}, SPY, and TLT.</div>
      <div><span class="text-gray-400">Key assumption:</span> Investors trade off expected return versus volatility.</div>
      <div><span class="text-gray-400">Applied here:</span> Sample many weight mixes to trace the frontier.</div>
    </div>`,
    kpis: [
      { id: "minvar", label: "Min-Variance Vol", value: formatPercent(frontierState.minVar.vol) },
      { id: "return", label: "Expected Return", value: formatPercent(selected.mean) },
      { id: "weight", label: "Weight on Ticker", value: formatPercent(selected.weights[0]) }
    ],
    charts: [{ id: "frontierPlot" }, { id: "frontierWeights" }],
    why: `The ticker and bonds show ${corrDesc} correlation, so diversification shifts volatility. With risk aversion ${defaultLambda}, the allocation is ${weightText}.`,
    takeaway: "Risk aversion moves the point along the frontier; the assets stay the same.",
    controls: [
      { id: "frontier-lambda", label: "Risk aversion (lambda)", min: 1, max: 10, step: 1, value: defaultLambda, display: String(defaultLambda) }
    ]
  };

  const tableRow = { id: "frontier", title: "Efficient Frontier", kpis: [card.kpis[0].value, card.kpis[1].value, card.kpis[2].value] };

  function renderCharts() {
    renderFrontierCharts({
      samples: frontierState.samples,
      minVar: frontierState.minVar,
      selected,
      weights: selected.weights,
      weightLabels: [state.ticker, "SPY", "TLT"]
    });
  }

  function attach(container) {
    const lambdaInput = container.querySelector("[data-control='frontier-lambda']");
    if (!lambdaInput) return;

    const update = () => {
      const lambda = Number(lambdaInput.value);
      selected = pickByLambda(frontierState.samples, lambda);

      updateKpi("frontier", "return", formatPercent(selected.mean));
      updateKpi("frontier", "weight", formatPercent(selected.weights[0]));
      updateCompare("frontier", 1, formatPercent(selected.mean));
      updateCompare("frontier", 2, formatPercent(selected.weights[0]));
      document.getElementById("frontier-lambda-val").textContent = String(lambda);
      const localWeights = `${formatPercent(selected.weights[0])} ${state.ticker} / ${formatPercent(selected.weights[1])} SPY / ${formatPercent(selected.weights[2])} TLT`;
      updateWhy("frontier", `The ticker and bonds show ${corrDesc} correlation, so diversification shifts volatility. With risk aversion ${lambda}, the allocation is ${localWeights}.`);

      renderCharts();
    };

    lambdaInput.addEventListener("input", update);
  }

  return { card, tableRow, render: renderCharts, attach };
}

function computeRiskState(series, returns, window, periodsPerYear) {
  const safeWindow = Math.min(window, returns.length);
  const returnsWindow = returns.slice(-safeWindow);
  const equityCurve = buildEquityFromReturns(returnsWindow);
  const drawdownSeries = buildDrawdownSeries(equityCurve);
  const rollingVol = calcRollingVolatility(returnsWindow, Math.min(safeWindow, window), periodsPerYear);
  const vol = calcVolatility(returnsWindow, periodsPerYear);
  const maxDD = calcMaxDrawdownFromEquity(equityCurve);
  const recovery = calcRecoveryTime(equityCurve);

  return {
    vol,
    maxDD,
    recovery,
    equityCurve,
    drawdownSeries,
    rollingVol,
    labels: toLabelArray(equityCurve)
  };
}

function buildRisk(state) {
  const series = state.series[state.ticker];
  const returns = state.returns[state.ticker];
  const defaultWindow = scaleWindow(60, state.periodsPerYear, 5);
  const minWindow = scaleWindow(20, state.periodsPerYear, 3);
  const maxWindow = scaleWindow(180, state.periodsPerYear, 12);
  const stepWindow = scaleStep(10, state.periodsPerYear);

  let riskState = computeRiskState(series, returns, defaultWindow, state.periodsPerYear);
  const recoveryText = riskState.recovery === null ? "Not recovered" : `${riskState.recovery} days`;
  const why = `Using a ${defaultWindow} ${state.unitLabel} window, volatility is ${formatPercent(riskState.vol)} and max drawdown is ${formatPercent(riskState.maxDD)}. Recovery time shows how long losses persisted.`;

  const card = {
    id: "risk",
    title: "Risk Metrics Dashboard",
    overview: `<div class="space-y-1">
      <div><span class="text-gray-400">What it does:</span> Summarizes volatility, drawdowns, and recovery time.</div>
      <div><span class="text-gray-400">Key assumption:</span> The path of returns matters as much as the average.</div>
      <div><span class="text-gray-400">Applied here:</span> Rolling windows show how risk changes over time.</div>
    </div>`,
    kpis: [
      { id: "vol", label: "Volatility", value: formatPercent(riskState.vol) },
      { id: "mdd", label: "Max Drawdown", value: formatPercent(riskState.maxDD) },
      { id: "recovery", label: "Recovery Time", value: recoveryText }
    ],
    charts: [{ id: "riskDrawdown" }, { id: "riskVol" }],
    why,
    takeaway: "Big drawdowns can dominate the experience even with decent average returns.",
    controls: [
      { id: "risk-window", label: `Rolling window (${state.unitLabel})`, min: minWindow, max: maxWindow, step: stepWindow, value: defaultWindow, display: `${defaultWindow} ${state.unitLabel}` }
    ]
  };

  const tableRow = { id: "risk", title: "Risk Metrics", kpis: [card.kpis[0].value, card.kpis[1].value, card.kpis[2].value] };

  function renderCharts() {
    renderRiskCharts({ labels: riskState.labels, drawdownSeries: riskState.drawdownSeries, rollingVol: riskState.rollingVol });
  }

  function attach(container) {
    const windowInput = container.querySelector("[data-control='risk-window']");
    if (!windowInput) return;

    const update = () => {
      const window = Number(windowInput.value);
      riskState = computeRiskState(series, returns, window, state.periodsPerYear);
      const recoveryLabel = riskState.recovery === null ? "Not recovered" : `${riskState.recovery} days`;

      updateKpi("risk", "vol", formatPercent(riskState.vol));
      updateKpi("risk", "mdd", formatPercent(riskState.maxDD));
      updateKpi("risk", "recovery", recoveryLabel);
      updateCompare("risk", 0, formatPercent(riskState.vol));
      updateCompare("risk", 1, formatPercent(riskState.maxDD));
      updateCompare("risk", 2, recoveryLabel);
      updateWhy("risk", `Using a ${window} ${state.unitLabel} window, volatility is ${formatPercent(riskState.vol)} and max drawdown is ${formatPercent(riskState.maxDD)}. Recovery time shows how long losses persisted.`);

      document.getElementById("risk-window-val").textContent = `${window} ${state.unitLabel}`;

      renderCharts();
    };

    windowInput.addEventListener("input", update);
  }

  return { card, tableRow, render: renderCharts, attach };
}
function normalizeWindows(shortWindow, longWindow) {
  if (shortWindow >= longWindow) {
    longWindow = shortWindow + 5;
  }
  return { shortWindow, longWindow };
}

function computeCrossoverState(series, returns, shortWindow, longWindow) {
  const sim = simulateCrossover(series, returns, shortWindow, longWindow);
  const equityCurve = sim.equityCurve;
  const buyHoldCurve = buildEquityCurve(series).slice(1);
  const tradeCount = countSignalChanges(sim.signals);
  const totalReturn = equityCurve.length ? equityCurve[equityCurve.length - 1].value - 1 : NaN;
  const maxDD = calcMaxDrawdownFromEquity(equityCurve);
  const lastSignal = sim.signals.length ? sim.signals[sim.signals.length - 1].s : 0;

  let lastShort = null;
  for (let i = sim.shortMa.length - 1; i >= 0; i -= 1) {
    const value = sim.shortMa[i]?.value;
    if (value !== null && value !== undefined) {
      lastShort = value;
      break;
    }
  }
  let lastLong = null;
  for (let i = sim.longMa.length - 1; i >= 0; i -= 1) {
    const value = sim.longMa[i]?.value;
    if (value !== null && value !== undefined) {
      lastLong = value;
      break;
    }
  }
  const relation = lastShort !== null && lastLong !== null ? (lastShort > lastLong ? "above" : "below") : "near";

  const seriesSlice = alignToReturns(series);
  const shortSlice = alignToReturns(sim.shortMa);
  const longSlice = alignToReturns(sim.longMa);

  return {
    equityCurve,
    buyHoldCurve,
    tradeCount,
    totalReturn,
    maxDD,
    lastSignal,
    relation,
    priceSeries: seriesToValues(seriesSlice),
    shortMa: shortSlice.map((p) => p.value),
    longMa: longSlice.map((p) => p.value),
    labels: toLabelArray(equityCurve)
  };
}

function buildCrossover(state) {
  const series = state.series[state.ticker];
  const returns = state.returns[state.ticker];
  const defaultShort = scaleWindow(20, state.periodsPerYear, 3);
  const defaultLong = scaleWindow(60, state.periodsPerYear, defaultShort + 5);
  const minShort = scaleWindow(5, state.periodsPerYear, 2);
  const maxShort = scaleWindow(60, state.periodsPerYear, minShort + 5);
  const minLong = scaleWindow(20, state.periodsPerYear, minShort + 10);
  const maxLong = scaleWindow(200, state.periodsPerYear, minLong + 10);
  const stepShort = scaleStep(1, state.periodsPerYear);
  const stepLong = scaleStep(5, state.periodsPerYear);

  let { shortWindow, longWindow } = normalizeWindows(defaultShort, defaultLong);
  let crossoverState = computeCrossoverState(series, returns, shortWindow, longWindow);
  const choppy = crossoverState.tradeCount > 8 ? "choppy" : "trending";
  const signalText = crossoverState.lastSignal === 1 ? "Long" : "Cash";
  const why = `The short average is ${crossoverState.relation} the long average, so the signal is ${signalText.toLowerCase()}. With ${crossoverState.tradeCount} trades, the regime looks ${choppy}.`;

  const card = {
    id: "crossover",
    title: "Moving Average Crossover",
    overview: `<div class="space-y-1">
      <div><span class="text-gray-400">What it does:</span> Uses short vs long moving averages to toggle exposure.</div>
      <div><span class="text-gray-400">Key assumption:</span> Trends persist, so crossovers can capture them.</div>
      <div><span class="text-gray-400">Applied here:</span> Signal switches when the short MA crosses the long MA.</div>
    </div>`,
    kpis: [
      { id: "trades", label: "Trade Count", value: String(crossoverState.tradeCount) },
      { id: "return", label: "Strategy Return", value: formatPercent(crossoverState.totalReturn) },
      { id: "mdd", label: "Max Drawdown", value: formatPercent(crossoverState.maxDD) }
    ],
    charts: [{ id: "crossoverPrice" }, { id: "crossoverEquity" }],
    why,
    takeaway: "Crossover rules struggle when prices whipsaw in sideways markets.",
    controls: [
      { id: "crossover-short", label: `Short MA (${state.unitLabel})`, min: minShort, max: maxShort, step: stepShort, value: shortWindow, display: `${shortWindow} ${state.unitLabel}` },
      { id: "crossover-long", label: `Long MA (${state.unitLabel})`, min: minLong, max: maxLong, step: stepLong, value: longWindow, display: `${longWindow} ${state.unitLabel}` }
    ]
  };

  const tableRow = { id: "crossover", title: "MA Crossover", kpis: [card.kpis[0].value, card.kpis[1].value, card.kpis[2].value] };

  function renderCharts() {
    renderCrossoverCharts({
      labels: crossoverState.labels,
      priceSeries: crossoverState.priceSeries,
      shortMa: crossoverState.shortMa,
      longMa: crossoverState.longMa,
      strategyCurve: crossoverState.equityCurve,
      buyHoldCurve: crossoverState.buyHoldCurve
    });
  }

  function attach(container) {
    const shortInput = container.querySelector("[data-control='crossover-short']");
    const longInput = container.querySelector("[data-control='crossover-long']");
    if (!shortInput || !longInput) return;

    const update = () => {
      let shortVal = Number(shortInput.value);
      let longVal = Number(longInput.value);
      ({ shortWindow: shortVal, longWindow: longVal } = normalizeWindows(shortVal, longVal));

      if (shortVal !== Number(shortInput.value)) shortInput.value = shortVal;
      if (longVal !== Number(longInput.value)) longInput.value = longVal;

      crossoverState = computeCrossoverState(series, returns, shortVal, longVal);
      const regime = crossoverState.tradeCount > 8 ? "choppy" : "trending";
      const signalLabel = crossoverState.lastSignal === 1 ? "Long" : "Cash";

      updateKpi("crossover", "trades", String(crossoverState.tradeCount));
      updateKpi("crossover", "return", formatPercent(crossoverState.totalReturn));
      updateKpi("crossover", "mdd", formatPercent(crossoverState.maxDD));
      updateCompare("crossover", 0, String(crossoverState.tradeCount));
      updateCompare("crossover", 1, formatPercent(crossoverState.totalReturn));
      updateCompare("crossover", 2, formatPercent(crossoverState.maxDD));
      updateWhy("crossover", `The short average is ${crossoverState.relation} the long average, so the signal is ${signalLabel.toLowerCase()}. With ${crossoverState.tradeCount} trades, the regime looks ${regime}.`);

      document.getElementById("crossover-short-val").textContent = `${shortVal} ${state.unitLabel}`;
      document.getElementById("crossover-long-val").textContent = `${longVal} ${state.unitLabel}`;

      renderCharts();
    };

    shortInput.addEventListener("input", update);
    longInput.addEventListener("input", update);
  }

  return { card, tableRow, render: renderCharts, attach };
}

function computeVolRegimeState(series, returns, window, threshold, periodsPerYear) {
  const sim = simulateVolRegime(returns, window, threshold, periodsPerYear);
  const equityCurve = sim.equityCurve;
  const buyHoldCurve = buildEquityCurve(series).slice(1);
  const maxDD = calcMaxDrawdownFromEquity(equityCurve);
  const totalReturn = equityCurve.length ? equityCurve[equityCurve.length - 1].value - 1 : NaN;

  const validVol = sim.rollingVol.filter((v) => v.value !== null && v.value !== undefined);
  const highCount = validVol.filter((v) => v.value > threshold).length;
  const highShare = validVol.length ? highCount / validVol.length : NaN;
  const latestVol = validVol.length ? validVol[validVol.length - 1].value : NaN;
  const currentRegime = Number.isFinite(latestVol) && latestVol > threshold ? "high" : "low";

  return {
    equityCurve,
    buyHoldCurve,
    maxDD,
    totalReturn,
    rollingVol: sim.rollingVol,
    highShare,
    latestVol,
    currentRegime,
    labels: toLabelArray(equityCurve)
  };
}

function buildVolRegime(state) {
  const series = state.series[state.ticker];
  const returns = state.returns[state.ticker];
  const defaultWindow = scaleWindow(20, state.periodsPerYear, 4);
  const minWindow = scaleWindow(10, state.periodsPerYear, 2);
  const maxWindow = scaleWindow(60, state.periodsPerYear, 8);
  const stepWindow = scaleStep(5, state.periodsPerYear);
  const defaultThreshold = 0.25;
  let currentThreshold = defaultThreshold;

  let volState = computeVolRegimeState(series, returns, defaultWindow, defaultThreshold, state.periodsPerYear);
  const latestText = Number.isFinite(volState.latestVol) ? formatPercent(volState.latestVol) : "N/A";
  const why = `High-volatility regimes appeared ${formatPercent(volState.highShare)} of the time. Current rolling vol is ${latestText}, which is ${volState.currentRegime} versus the ${formatPercent(defaultThreshold)} threshold.`;

  const card = {
    id: "volregime",
    title: "Volatility Regime Control",
    overview: `<div class="space-y-1">
      <div><span class="text-gray-400">What it does:</span> Scales exposure down when volatility exceeds a threshold.</div>
      <div><span class="text-gray-400">Key assumption:</span> High-volatility regimes are riskier to hold fully.</div>
      <div><span class="text-gray-400">Applied here:</span> Rolling volatility is compared to a user-chosen cutoff.</div>
    </div>`,
    kpis: [
      { id: "high", label: "High-Vol Share", value: formatPercent(volState.highShare) },
      { id: "return", label: "Strategy Return", value: formatPercent(volState.totalReturn) },
      { id: "mdd", label: "Max Drawdown", value: formatPercent(volState.maxDD) }
    ],
    charts: [{ id: "volRegimeVol" }, { id: "volRegimeEquity" }],
    why,
    takeaway: "Risk control trades off upside for smoother paths and smaller drawdowns.",
    controls: [
      { id: "volregime-window", label: `Regime window (${state.unitLabel})`, min: minWindow, max: maxWindow, step: stepWindow, value: defaultWindow, display: `${defaultWindow} ${state.unitLabel}` },
      { id: "volregime-threshold", label: "Volatility threshold", min: 0.1, max: 0.6, step: 0.01, value: defaultThreshold, display: formatPercent(defaultThreshold) }
    ]
  };

  const tableRow = { id: "volregime", title: "Volatility Regime", kpis: [card.kpis[0].value, card.kpis[1].value, card.kpis[2].value] };

  function renderCharts() {
    renderVolRegimeCharts({
      labels: volState.labels,
      rollingVol: volState.rollingVol,
      thresholdLine: volState.labels.map(() => currentThreshold),
      strategyCurve: volState.equityCurve,
      buyHoldCurve: volState.buyHoldCurve
    });
  }

  function attach(container) {
    const windowInput = container.querySelector("[data-control='volregime-window']");
    const thresholdInput = container.querySelector("[data-control='volregime-threshold']");
    if (!windowInput || !thresholdInput) return;

    const update = () => {
      const window = Number(windowInput.value);
      const threshold = Number(thresholdInput.value);
      currentThreshold = threshold;

      volState = computeVolRegimeState(series, returns, window, threshold, state.periodsPerYear);

      updateKpi("volregime", "high", formatPercent(volState.highShare));
      updateKpi("volregime", "return", formatPercent(volState.totalReturn));
      updateKpi("volregime", "mdd", formatPercent(volState.maxDD));
      updateCompare("volregime", 0, formatPercent(volState.highShare));
      updateCompare("volregime", 1, formatPercent(volState.totalReturn));
      updateCompare("volregime", 2, formatPercent(volState.maxDD));
      const latest = Number.isFinite(volState.latestVol) ? formatPercent(volState.latestVol) : "N/A";
      updateWhy("volregime", `High-volatility regimes appeared ${formatPercent(volState.highShare)} of the time. Current rolling vol is ${latest}, which is ${volState.currentRegime} versus the ${formatPercent(threshold)} threshold.`);

      document.getElementById("volregime-window-val").textContent = `${window} ${state.unitLabel}`;
      document.getElementById("volregime-threshold-val").textContent = formatPercent(threshold);

      renderVolRegimeCharts({
        labels: volState.labels,
        rollingVol: volState.rollingVol,
        thresholdLine: volState.labels.map(() => threshold),
        strategyCurve: volState.equityCurve,
        buyHoldCurve: volState.buyHoldCurve
      });
    };

    windowInput.addEventListener("input", update);
    thresholdInput.addEventListener("input", update);
  }

  return { card, tableRow, render: renderCharts, attach };
}

async function runApp() {
  clearError();
  setLoading(true);

  const ticker = document.getElementById("tickerInput").value.trim().toUpperCase();
  const selected = [...document.querySelectorAll("[data-theory]:checked")].map((i) => i.dataset.theory);

  if (!ticker) {
    setLoading(false);
    showError("Please enter a ticker.");
    return;
  }
  if (!selected.length) {
    setLoading(false);
    showError("Select at least one theory.");
    return;
  }

  try {
    const symbols = collectSymbols(selected, ticker);
    const { seriesMap, returnsMap, interval } = await loadSeries(symbols);
    const meta = getIntervalMeta(interval);
    const state = {
      ticker,
      series: seriesMap,
      returns: returnsMap,
      interval,
      periodsPerYear: meta.periodsPerYear,
      unitLabel: meta.unit
    };

    const cards = [];
    const tableRows = [];
    const hooks = [];

    if (selected.includes("capm")) {
      const capm = buildCapm(state);
      cards.push(capm.card);
      tableRows.push(capm.tableRow);
      hooks.push(capm);
    }
    if (selected.includes("ff3")) {
      const ff = buildFf(state);
      cards.push(ff.card);
      tableRows.push(ff.tableRow);
      hooks.push(ff);
    }
    if (selected.includes("momentum")) {
      const momentum = buildMomentum(state);
      cards.push(momentum.card);
      tableRows.push(momentum.tableRow);
      hooks.push(momentum);
    }
    if (selected.includes("meanrev")) {
      const meanrev = buildMeanRev(state);
      cards.push(meanrev.card);
      tableRows.push(meanrev.tableRow);
      hooks.push(meanrev);
    }
    if (selected.includes("frontier")) {
      const frontier = buildFrontier(state);
      cards.push(frontier.card);
      tableRows.push(frontier.tableRow);
      hooks.push(frontier);
    }
    if (selected.includes("risk")) {
      const risk = buildRisk(state);
      cards.push(risk.card);
      tableRows.push(risk.tableRow);
      hooks.push(risk);
    }
    if (selected.includes("crossover")) {
      const crossover = buildCrossover(state);
      cards.push(crossover.card);
      tableRows.push(crossover.tableRow);
      hooks.push(crossover);
    }
    if (selected.includes("volregime")) {
      const volregime = buildVolRegime(state);
      cards.push(volregime.card);
      tableRows.push(volregime.tableRow);
      hooks.push(volregime);
    }

    renderComparisonTable(tableRows);
    const container = document.getElementById("theoryCards");
    container.innerHTML = "";
    cards.forEach((card) => {
      const element = renderTheoryCard(card);
      container.appendChild(element);
    });

    hooks.forEach((hook) => {
      hook.render();
      const cardContainer = document.getElementById(`card-${hook.card.id}`);
      hook.attach(cardContainer);
    });

    APP.lastRun = { ticker, range: APP.range, selected, state };
    resultsSection.classList.remove("hidden");
  } catch (err) {
    showError(err.message || "Failed to fetch data.");
  } finally {
    setLoading(false);
  }
}

// 한국어 주석: About 모달 열기/닫기
const aboutBtn = document.getElementById("aboutBtn");
const aboutModal = document.getElementById("aboutModal");
const aboutClose = document.getElementById("aboutClose");

function openAbout() {
  if (!aboutModal) return;
  aboutModal.classList.remove("hidden");
  aboutModal.classList.add("flex");
}

function closeAbout() {
  if (!aboutModal) return;
  aboutModal.classList.add("hidden");
  aboutModal.classList.remove("flex");
}

if (aboutBtn) {
  aboutBtn.addEventListener("click", openAbout);
}
if (aboutClose) {
  aboutClose.addEventListener("click", closeAbout);
}
if (aboutModal) {
  aboutModal.addEventListener("click", (event) => {
    if (event.target === aboutModal) closeAbout();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAbout();
  });
}

document.getElementById("runBtn").addEventListener("click", runApp);

document.querySelectorAll(".period-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    APP.range = btn.dataset.range;
    document.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("period-active"));
    btn.classList.add("period-active");
  });
});

document.getElementById("customApply").addEventListener("click", () => {
  APP.range = "CUSTOM";
  document.querySelectorAll(".period-btn").forEach((b) => b.classList.remove("period-active"));
});
