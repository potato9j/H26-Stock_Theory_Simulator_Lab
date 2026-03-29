export function formatPercent(value) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return "N/A";
  return (value * 100).toFixed(2) + "%";
}

export function formatNumber(value, digits = 2) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return "N/A";
  return value.toFixed(digits);
}

export function formatDateLabel(date) {
  const dateObj = date instanceof Date ? date : new Date(date);
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function sliceByRange(series, range, startStr, endStr) {
  // 한국어 주석: 기간 버튼/커스텀 날짜로 필터링
  if (!series.length) return [];
  let startDate = null;

  if (range === "CUSTOM" && startStr && endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    return series.filter((d) => new Date(d.t) >= start && new Date(d.t) <= end);
  }

  const now = new Date(series[series.length - 1].t);
  if (range === "1M") {
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 1);
  }
  if (range === "6M") {
    startDate = new Date(now);
    startDate.setMonth(startDate.getMonth() - 6);
  }
  if (range === "1Y") {
    startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 1);
  }
  if (range === "3Y") {
    startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 3);
  }
  if (range === "5Y") {
    startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 5);
  }
  if (!startDate) return series;
  return series.filter((d) => new Date(d.t) >= startDate);
}

export function toLogReturns(series) {
  // 한국어 주석: 로그 수익률 계산
  if (series.length < 2) return [];
  const out = [];
  for (let i = 1; i < series.length; i++) {
    const r = Math.log(series[i].c / series[i - 1].c);
    out.push({ t: new Date(series[i].t), r });
  }
  return out;
}

export function logToSimple(logReturn) {
  return Math.exp(logReturn) - 1;
}

export function calcAnnualizedReturn(returns, periodsPerYear = 252) {
  if (!returns.length) return NaN;
  const mean = returns.reduce((a, b) => a + b.r, 0) / returns.length;
  return mean * periodsPerYear;
}

export function calcVolatility(returns, periodsPerYear = 252) {
  // 한국어 주석: 연율화 변동성 계산
  if (returns.length < 2) return NaN;
  const mean = returns.reduce((a, b) => a + b.r, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b.r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
}

export function calcRollingVolatility(returns, window, periodsPerYear = 252) {
  // 한국어 주석: 롤링 변동성 계산
  if (!returns.length) return [];
  const out = [];
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < returns.length; i++) {
    const r = returns[i].r;
    sum += r;
    sumSq += r * r;
    if (i >= window) {
      const remove = returns[i - window].r;
      sum -= remove;
      sumSq -= remove * remove;
    }
    if (i >= window - 1) {
      const mean = sum / window;
      const variance = Math.max(sumSq / window - mean * mean, 0);
      out.push({ t: returns[i].t, value: Math.sqrt(variance) * Math.sqrt(periodsPerYear) });
    } else {
      out.push({ t: returns[i].t, value: null });
    }
  }
  return out;
}

export function buildEquityCurve(series) {
  // 한국어 주석: 가격 기반 누적 곡선 생성
  if (!series.length) return [];
  const points = [{ t: new Date(series[0].t), value: 1 }];
  for (let i = 1; i < series.length; i++) {
    const value = points[i - 1].value * (series[i].c / series[i - 1].c);
    points.push({ t: new Date(series[i].t), value });
  }
  return points;
}

export function buildEquityFromReturns(returns, signals) {
  // 한국어 주석: 신호 기반 전략 누적 곡선 생성
  if (!returns.length) return [];
  const points = [];
  let value = 1;
  for (let i = 0; i < returns.length; i++) {
    const signal = signals ? signals[i].s : 1;
    const daily = logToSimple(returns[i].r);
    value *= 1 + signal * daily;
    points.push({ t: returns[i].t, value });
  }
  return points;
}

export function calcMaxDrawdown(series) {
  // 한국어 주석: 누적 수익 기반 MDD 계산
  if (series.length < 2) return NaN;
  let peak = -Infinity;
  let maxDD = 0;
  let equity = 1;
  for (let i = 1; i < series.length; i++) {
    equity *= series[i].c / series[i - 1].c;
    if (equity > peak) peak = equity;
    const dd = (equity - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

export function calcMaxDrawdownFromEquity(equityCurve) {
  if (equityCurve.length < 2) return NaN;
  let peak = -Infinity;
  let maxDD = 0;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const dd = (point.value - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return maxDD;
}

export function buildDrawdownSeries(equityCurve) {
  // 한국어 주석: 드로다운 곡선 생성
  let peak = -Infinity;
  return equityCurve.map((point) => {
    if (point.value > peak) peak = point.value;
    const dd = (point.value - peak) / peak;
    return { t: point.t, value: dd };
  });
}

export function calcRecoveryTime(equityCurve) {
  // 한국어 주석: 최대 낙폭 회복까지 걸린 기간 계산
  if (equityCurve.length < 2) return null;
  let peak = equityCurve[0].value;
  let peakIndex = 0;
  let maxDD = 0;
  let troughIndex = 0;
  let peakAtMax = peak;

  for (let i = 1; i < equityCurve.length; i++) {
    const value = equityCurve[i].value;
    if (value > peak) {
      peak = value;
      peakIndex = i;
    }
    const dd = (value - peak) / peak;
    if (dd < maxDD) {
      maxDD = dd;
      troughIndex = i;
      peakAtMax = peak;
    }
  }

  for (let i = troughIndex; i < equityCurve.length; i++) {
    if (equityCurve[i].value >= peakAtMax) {
      const diffMs = equityCurve[i].t - equityCurve[troughIndex].t;
      return Math.round(diffMs / (1000 * 60 * 60 * 24));
    }
  }
  return null;
}

export function calcMovingAverage(series, window) {
  // 한국어 주석: 이동평균 계산
  if (!series.length) return [];
  const out = [];
  let sum = 0;
  for (let i = 0; i < series.length; i++) {
    sum += series[i].c;
    if (i >= window) {
      sum -= series[i - window].c;
    }
    if (i >= window - 1) {
      out.push({ t: new Date(series[i].t), value: sum / window });
    } else {
      out.push({ t: new Date(series[i].t), value: null });
    }
  }
  return out;
}

export function calcRollingStd(series, window) {
  // 한국어 주석: 롤링 표준편차 계산
  if (!series.length) return [];
  const out = [];
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < series.length; i++) {
    const value = series[i].c;
    sum += value;
    sumSq += value * value;
    if (i >= window) {
      const remove = series[i - window].c;
      sum -= remove;
      sumSq -= remove * remove;
    }
    if (i >= window - 1) {
      const mean = sum / window;
      const variance = Math.max(sumSq / window - mean * mean, 0);
      out.push({ t: new Date(series[i].t), value: Math.sqrt(variance) });
    } else {
      out.push({ t: new Date(series[i].t), value: null });
    }
  }
  return out;
}

export function calcZScoreSeries(series, window) {
  // 한국어 주석: 가격 기반 Z-Score 계산
  const ma = calcMovingAverage(series, window);
  const std = calcRollingStd(series, window);
  return series.map((point, i) => {
    if (!ma[i].value || !std[i].value) {
      return { t: new Date(point.t), value: null };
    }
    return { t: new Date(point.t), value: (point.c - ma[i].value) / std[i].value };
  });
}

export function alignReturns(assetReturns, marketReturns) {
  // 한국어 주석: 날짜 기준으로 수익률 정렬
  const marketMap = new Map(marketReturns.map((r) => [formatDateLabel(r.t), r.r]));
  const pairs = [];
  for (const a of assetReturns) {
    const key = formatDateLabel(a.t);
    const m = marketMap.get(key);
    if (m !== undefined) pairs.push({ t: a.t, ar: a.r, mr: m });
  }
  return pairs;
}

export function alignReturnsMap(returnsMap) {
  // 한국어 주석: 여러 수익률 시계열 교집합 정렬
  const keys = Object.keys(returnsMap);
  if (!keys.length) return [];
  const maps = keys.map((key) => new Map(returnsMap[key].map((r) => [formatDateLabel(r.t), r.r])));
  let commonDates = new Set(maps[0].keys());
  for (let i = 1; i < maps.length; i++) {
    commonDates = new Set([...commonDates].filter((date) => maps[i].has(date)));
  }
  const dates = [...commonDates].sort();
  return dates.map((date) => {
    const row = { t: new Date(date) };
    keys.forEach((key, idx) => {
      row[key] = maps[idx].get(date);
    });
    return row;
  });
}

export function calcBeta(pairs) {
  // 한국어 주석: 베타와 R2 계산
  if (pairs.length < 2) return { beta: NaN, r2: NaN };
  const meanA = pairs.reduce((s, x) => s + x.ar, 0) / pairs.length;
  const meanM = pairs.reduce((s, x) => s + x.mr, 0) / pairs.length;
  let cov = 0;
  let varM = 0;
  let varA = 0;
  for (const p of pairs) {
    cov += (p.ar - meanA) * (p.mr - meanM);
    varM += (p.mr - meanM) ** 2;
    varA += (p.ar - meanA) ** 2;
  }
  const beta = cov / varM;
  const r2 = (cov ** 2) / (varA * varM);
  return { beta, r2 };
}

export function countSignalChanges(signalSeries) {
  if (!signalSeries.length) return 0;
  let count = 0;
  let prev = signalSeries[0].s;
  for (let i = 1; i < signalSeries.length; i++) {
    if (signalSeries[i].s !== prev) {
      count += 1;
      prev = signalSeries[i].s;
    }
  }
  return count;
}

export function buildCumulativeFromReturns(returns) {
  if (!returns.length) return [];
  const out = [];
  let value = 1;
  for (const point of returns) {
    value *= 1 + logToSimple(point.r);
    out.push({ t: point.t, value });
  }
  return out;
}

export function simulateMomentum(series, returns, lookback, rebalance) {
  // 한국어 주석: 모멘텀 전략 시뮬레이션
  const signals = [];
  let current = 0;
  for (let i = 0; i < returns.length; i++) {
    const seriesIndex = i + 1;
    if (seriesIndex >= lookback && i % rebalance === 0) {
      const pastPrice = series[seriesIndex - lookback].c;
      const currentPrice = series[seriesIndex].c;
      current = currentPrice / pastPrice - 1 > 0 ? 1 : 0;
    }
    signals.push({ t: returns[i].t, s: current });
  }
  const equityCurve = buildEquityFromReturns(returns, signals);
  return { signals, equityCurve };
}

export function simulateMeanReversion(series, returns, window, threshold) {
  // 한국어 주석: 평균회귀 전략 시뮬레이션
  const ma = calcMovingAverage(series, window);
  const std = calcRollingStd(series, window);
  const zscores = calcZScoreSeries(series, window);
  const signals = [];
  let current = 0;
  for (let i = 0; i < returns.length; i++) {
    const seriesIndex = i + 1;
    const z = zscores[seriesIndex]?.value;
    if (z !== null && z !== undefined) {
      if (z <= -threshold) current = 1;
      if (z >= 0) current = 0;
    }
    signals.push({ t: returns[i].t, s: current });
  }
  const equityCurve = buildEquityFromReturns(returns, signals);
  return { signals, equityCurve, ma, std, zscores };
}

export function simulateCrossover(series, returns, shortWindow, longWindow) {
  // 한국어 주석: 이동평균 크로스오버 전략 시뮬레이션
  const shortMa = calcMovingAverage(series, shortWindow);
  const longMa = calcMovingAverage(series, longWindow);
  const signals = [];
  let current = 0;
  for (let i = 0; i < returns.length; i++) {
    const seriesIndex = i + 1;
    const shortVal = shortMa[seriesIndex]?.value;
    const longVal = longMa[seriesIndex]?.value;
    if (shortVal !== null && longVal !== null && shortVal !== undefined && longVal !== undefined) {
      current = shortVal > longVal ? 1 : 0;
    }
    signals.push({ t: returns[i].t, s: current });
  }
  const equityCurve = buildEquityFromReturns(returns, signals);
  return { signals, equityCurve, shortMa, longMa };
}

export function simulateVolRegime(returns, window, threshold, periodsPerYear = 252) {
  // 한국어 주석: 변동성 레짐 전략 시뮬레이션
  const rollingVol = calcRollingVolatility(returns, window, periodsPerYear);
  const signals = [];
  for (let i = 0; i < returns.length; i++) {
    const vol = rollingVol[i]?.value;
    const signal = vol !== null && vol !== undefined && vol <= threshold ? 1 : 0;
    signals.push({ t: returns[i].t, s: signal });
  }
  const equityCurve = buildEquityFromReturns(returns, signals);
  return { signals, equityCurve, rollingVol };
}

export function buildFactorSeries(marketReturns, sizeReturns, valueReturns) {
  // 한국어 주석: 시장/사이즈/가치 요인 시계열 생성
  const aligned = alignReturnsMap({ mkt: marketReturns, size: sizeReturns, value: valueReturns });
  return aligned.map((row) => ({
    t: row.t,
    mkt: row.mkt,
    smb: row.size - row.mkt,
    hml: row.value - row.mkt
  }));
}

export function alignAssetFactors(assetReturns, factorSeries) {
  // 한국어 주석: 자산 수익률과 요인 시계열 정렬
  const factorMap = new Map(factorSeries.map((f) => [formatDateLabel(f.t), f]));
  const aligned = [];
  for (const r of assetReturns) {
    const key = formatDateLabel(r.t);
    const factors = factorMap.get(key);
    if (!factors) continue;
    aligned.push({ t: r.t, ar: r.r, mkt: factors.mkt, smb: factors.smb, hml: factors.hml });
  }
  return aligned;
}

function solveLinearSystem(matrix, vector) {
  const n = matrix.length;
  const m = matrix.map((row, i) => row.slice().concat(vector[i]));

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(m[k][i]) > Math.abs(m[maxRow][i])) maxRow = k;
    }
    if (Math.abs(m[maxRow][i]) < 1e-10) return null;
    if (maxRow !== i) {
      const temp = m[i];
      m[i] = m[maxRow];
      m[maxRow] = temp;
    }

    const pivot = m[i][i];
    for (let j = i; j < n + 1; j++) {
      m[i][j] /= pivot;
    }

    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = m[k][i];
      for (let j = i; j < n + 1; j++) {
        m[k][j] -= factor * m[i][j];
      }
    }
  }

  return m.map((row) => row[n]);
}

export function calcMultiFactorRegression(observations, useThree) {
  // 한국어 주석: 다중 회귀로 요인 로딩 계산
  if (observations.length < 5) {
    return { alpha: NaN, betas: [], r2: NaN, predicted: [] };
  }

  const y = observations.map((o) => o.ar);
  const x = observations.map((o) =>
    useThree ? [1, o.mkt, o.smb, o.hml] : [1, o.mkt]
  );

  const cols = x[0].length;
  const xtx = Array.from({ length: cols }, () => Array(cols).fill(0));
  const xty = Array(cols).fill(0);

  for (let i = 0; i < x.length; i++) {
    for (let r = 0; r < cols; r++) {
      xty[r] += x[i][r] * y[i];
      for (let c = 0; c < cols; c++) {
        xtx[r][c] += x[i][r] * x[i][c];
      }
    }
  }

  const coeff = solveLinearSystem(xtx, xty);
  if (!coeff) {
    return { alpha: NaN, betas: [], r2: NaN, predicted: [] };
  }

  const alpha = coeff[0];
  const betas = coeff.slice(1);
  const predicted = y.map((_, i) => {
    let value = alpha;
    for (let j = 0; j < betas.length; j++) {
      value += betas[j] * x[i][j + 1];
    }
    return value;
  });

  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < y.length; i++) {
    ssRes += (y[i] - predicted[i]) ** 2;
    ssTot += (y[i] - meanY) ** 2;
  }
  const r2 = ssTot ? 1 - ssRes / ssTot : NaN;

  return { alpha, betas, r2, predicted };
}

export function calcMeanVector(matrix) {
  if (!matrix.length) return [];
  const cols = matrix[0].length;
  const mean = Array(cols).fill(0);
  for (const row of matrix) {
    for (let i = 0; i < cols; i++) {
      mean[i] += row[i];
    }
  }
  for (let i = 0; i < cols; i++) {
    mean[i] /= matrix.length;
  }
  return mean;
}

export function calcCovMatrix(matrix) {
  if (!matrix.length) return [];
  const cols = matrix[0].length;
  const mean = calcMeanVector(matrix);
  const cov = Array.from({ length: cols }, () => Array(cols).fill(0));
  for (const row of matrix) {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < cols; j++) {
        cov[i][j] += (row[i] - mean[i]) * (row[j] - mean[j]);
      }
    }
  }
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      cov[i][j] /= matrix.length - 1;
    }
  }
  return cov;
}

export function sampleWeights(assetCount, sampleCount) {
  const samples = [];
  for (let i = 0; i < sampleCount; i++) {
    const raw = Array.from({ length: assetCount }, () => Math.random());
    const sum = raw.reduce((a, b) => a + b, 0);
    samples.push(raw.map((v) => v / sum));
  }
  return samples;
}

export function portfolioStats(weights, meanVec, covMatrix) {
  const mean = weights.reduce((sum, w, i) => sum + w * meanVec[i], 0);
  let variance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      variance += weights[i] * weights[j] * covMatrix[i][j];
    }
  }
  return { mean, variance, vol: Math.sqrt(variance) };
}
