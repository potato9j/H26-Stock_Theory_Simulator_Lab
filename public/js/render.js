const chartStore = new Map();

export function renderComparisonTable(rows) {
  const container = document.getElementById("comparisonTable");
  if (!rows.length) {
    container.innerHTML = "No theories selected.";
    return;
  }
  const header = `<div class="grid grid-cols-4 gap-2 text-xs text-gray-400 mb-2">
    <div>Theory</div><div>Metric 1</div><div>Metric 2</div><div>Metric 3</div></div>`;
  const body = rows
    .map(
      (r) => `
      <div class="grid grid-cols-4 gap-2 py-2 border-t border-gray-700 text-sm" data-compare="${r.id}">
        <div>${r.title}</div>
        <div data-compare-kpi="${r.id}-0">${r.kpis[0]}</div>
        <div data-compare-kpi="${r.id}-1">${r.kpis[1]}</div>
        <div data-compare-kpi="${r.id}-2">${r.kpis[2]}</div>
      </div>`
    )
    .join("");
  container.innerHTML = header + body;
}

export function renderTheoryCard(card) {
  const wrap = document.createElement("div");
  wrap.className = "card p-5 fade-in";
  wrap.id = `card-${card.id}`;
  wrap.innerHTML = `
    <h3 class="text-xl font-semibold mb-3">${card.title}</h3>
    <div class="text-sm text-gray-300 mb-3" id="${card.id}-overview">${card.overview}</div>
    <div class="flex flex-wrap gap-2 mb-4">
      ${card.kpis
        .map(
          (k) => `
        <div class="chip rounded-xl px-3 py-2 text-sm">
          <div class="text-gray-400 text-xs">${k.label}</div>
          <div data-kpi="${card.id}-${k.id}">${k.value}</div>
        </div>`
        )
        .join("")}
    </div>
    <div class="chart-grid mb-4">
      ${card.charts.map((c) => `<div class="chart-shell"><canvas id="${c.id}"></canvas></div>`).join("")}
    </div>
    <div class="text-sm text-gray-300 mb-3" id="${card.id}-why">${card.why}</div>
    <div class="text-sm accent mb-4" id="${card.id}-takeaway">${card.takeaway}</div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${card.controls
        .map(
          (ctrl) => `
        <label class="text-sm">
          <div class="text-gray-400 mb-1">${ctrl.label}: <span id="${ctrl.id}-val">${ctrl.display ?? ctrl.value}</span></div>
          <input type="range" min="${ctrl.min}" max="${ctrl.max}" step="${ctrl.step}" value="${ctrl.value}" data-control="${ctrl.id}" class="w-full" />
        </label>`
        )
        .join("")}
    </div>
  `;
  return wrap;
}

// 한국어 주석: 차트 렌더링 상태 관리
export function renderChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return;
  ensureChartDefaults();
  const ctx = canvas.getContext("2d");
  if (chartStore.has(id)) {
    chartStore.get(id).destroy();
  }
  const chart = new window.Chart(ctx, applyBaseOptions(config));
  chartStore.set(id, chart);
}

export function renderCapmCharts({ pairs, assetCurve, marketCurve, labels }) {
  const scatterData = pairs.map((p) => ({ x: p.mr, y: p.ar }));
  renderChart("capmScatter", {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Returns",
          data: scatterData,
          backgroundColor: "rgba(110,231,183,0.7)",
          pointRadius: 3
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Market Return", color: "#cbd5f5" }, ticks: axisTicks(), grid: axisGrid() },
        y: { title: { display: true, text: "Asset Return", color: "#cbd5f5" }, ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });

  renderChart("capmCurve", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Asset",
          data: assetCurve.map((p) => p.value),
          borderColor: "#f5c242",
          backgroundColor: "rgba(245,194,66,0.12)",
          tension: 0.2
        },
        {
          label: "Market (SPY)",
          data: marketCurve.map((p) => p.value),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147,197,253,0.12)",
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });
}

export function renderFfCharts({ loadings, labels, actualCurve, modelCurve }) {
  renderChart("ffLoadings", {
    type: "bar",
    data: {
      labels: ["MKT", "SMB", "HML"],
      datasets: [
        {
          label: "Factor Loadings",
          data: loadings,
          backgroundColor: ["#93c5fd", "#f5c242", "#6ee7b7"]
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });

  renderChart("ffFit", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Actual",
          data: actualCurve.map((p) => p.value),
          borderColor: "#f5c242",
          backgroundColor: "rgba(245,194,66,0.12)",
          tension: 0.2
        },
        {
          label: "Model",
          data: modelCurve.map((p) => p.value),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147,197,253,0.12)",
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });
}

export function renderMomentumCharts({ labels, strategyCurve, buyHoldCurve, signalSeries }) {
  renderChart("momentumEquity", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Momentum",
          data: strategyCurve.map((p) => p.value),
          borderColor: "#f5c242",
          backgroundColor: "rgba(245,194,66,0.12)",
          tension: 0.2
        },
        {
          label: "Buy and Hold",
          data: buyHoldCurve.map((p) => p.value),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147,197,253,0.12)",
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });

  renderChart("momentumSignal", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Signal",
          data: signalSeries.map((s) => s.s),
          borderColor: "#6ee7b7",
          backgroundColor: "rgba(110,231,183,0.12)",
          stepped: true
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid(), min: -0.1, max: 1.1 }
      }
    }
  });
}

export function renderMeanRevCharts({ labels, priceSeries, maSeries, upperBand, lowerBand, strategyCurve, buyHoldCurve }) {
  renderChart("meanrevPrice", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Price",
          data: priceSeries,
          borderColor: "#f5c242",
          backgroundColor: "rgba(245,194,66,0.08)",
          tension: 0.2
        },
        {
          label: "Moving Average",
          data: maSeries,
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147,197,253,0.08)",
          tension: 0.2
        },
        {
          label: "Upper Band",
          data: upperBand,
          borderColor: "rgba(239,68,68,0.6)",
          borderDash: [4, 4],
          tension: 0.2
        },
        {
          label: "Lower Band",
          data: lowerBand,
          borderColor: "rgba(52,211,153,0.6)",
          borderDash: [4, 4],
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });

  renderChart("meanrevEquity", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Mean Reversion",
          data: strategyCurve.map((p) => p.value),
          borderColor: "#f5c242",
          backgroundColor: "rgba(245,194,66,0.12)",
          tension: 0.2
        },
        {
          label: "Buy and Hold",
          data: buyHoldCurve.map((p) => p.value),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147,197,253,0.12)",
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });
}

export function renderFrontierCharts({ samples, minVar, selected, weights, weightLabels }) {
  renderChart("frontierPlot", {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Sampled Portfolios",
          data: samples.map((s) => ({ x: s.vol, y: s.mean })),
          backgroundColor: "rgba(148,163,184,0.4)",
          pointRadius: 2
        },
        {
          label: "Min Variance",
          data: [{ x: minVar.vol, y: minVar.mean }],
          backgroundColor: "#6ee7b7",
          pointRadius: 5
        },
        {
          label: "Selected",
          data: [{ x: selected.vol, y: selected.mean }],
          backgroundColor: "#f5c242",
          pointRadius: 6
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { title: { display: true, text: "Volatility", color: "#cbd5f5" }, ticks: axisTicks(), grid: axisGrid() },
        y: { title: { display: true, text: "Expected Return", color: "#cbd5f5" }, ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });

  renderChart("frontierWeights", {
    type: "bar",
    data: {
      labels: weightLabels,
      datasets: [
        {
          label: "Weights",
          data: weights,
          backgroundColor: ["#f5c242", "#93c5fd", "#6ee7b7"]
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid(), min: 0, max: 1 }
      }
    }
  });
}

export function renderRiskCharts({ labels, drawdownSeries, rollingVol }) {
  renderChart("riskDrawdown", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Drawdown",
          data: drawdownSeries.map((p) => p.value),
          borderColor: "#f87171",
          backgroundColor: "rgba(248,113,113,0.18)",
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });

  renderChart("riskVol", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Rolling Volatility",
          data: rollingVol.map((p) => p.value),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147,197,253,0.12)",
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });
}

export function renderCrossoverCharts({ labels, priceSeries, shortMa, longMa, strategyCurve, buyHoldCurve }) {
  renderChart("crossoverPrice", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Price",
          data: priceSeries,
          borderColor: "#f5c242",
          backgroundColor: "rgba(245,194,66,0.08)",
          tension: 0.2
        },
        {
          label: "Short MA",
          data: shortMa,
          borderColor: "#6ee7b7",
          backgroundColor: "rgba(110,231,183,0.08)",
          tension: 0.2
        },
        {
          label: "Long MA",
          data: longMa,
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147,197,253,0.08)",
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });

  renderChart("crossoverEquity", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Crossover",
          data: strategyCurve.map((p) => p.value),
          borderColor: "#f5c242",
          backgroundColor: "rgba(245,194,66,0.12)",
          tension: 0.2
        },
        {
          label: "Buy and Hold",
          data: buyHoldCurve.map((p) => p.value),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147,197,253,0.12)",
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });
}

export function renderVolRegimeCharts({ labels, rollingVol, thresholdLine, strategyCurve, buyHoldCurve }) {
  renderChart("volRegimeVol", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Rolling Volatility",
          data: rollingVol.map((p) => p.value),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147,197,253,0.12)",
          tension: 0.2
        },
        {
          label: "Threshold",
          data: thresholdLine,
          borderColor: "#f5c242",
          borderDash: [5, 5],
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });

  renderChart("volRegimeEquity", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Risk Control",
          data: strategyCurve.map((p) => p.value),
          borderColor: "#f5c242",
          backgroundColor: "rgba(245,194,66,0.12)",
          tension: 0.2
        },
        {
          label: "Buy and Hold",
          data: buyHoldCurve.map((p) => p.value),
          borderColor: "#93c5fd",
          backgroundColor: "rgba(147,197,253,0.12)",
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: axisTicks(), grid: axisGrid() },
        y: { ticks: axisTicks(), grid: axisGrid() }
      }
    }
  });
}

let defaultsReady = false;

function ensureChartDefaults() {
  if (defaultsReady || !window.Chart) return;
  window.Chart.defaults.responsive = true;
  window.Chart.defaults.maintainAspectRatio = false;
  window.Chart.defaults.color = "#9ca3af";
  window.Chart.defaults.font.family = "'Space Grotesk', sans-serif";
  window.Chart.defaults.font.size = 11;
  window.Chart.defaults.plugins.legend.labels.usePointStyle = true;
  window.Chart.defaults.plugins.legend.labels.boxWidth = 10;
  window.Chart.defaults.plugins.legend.labels.boxHeight = 10;
  defaultsReady = true;
}

function axisTicks() {
  return { color: "#9ca3af", maxTicksLimit: 6, autoSkip: true, maxRotation: 0, minRotation: 0 };
}

function axisGrid() {
  return { color: "rgba(148, 163, 184, 0.12)" };
}

function applyBaseOptions(config) {
  if (!config.options) config.options = {};
  if (config.options.responsive === undefined) config.options.responsive = true;
  if (config.options.maintainAspectRatio === undefined) config.options.maintainAspectRatio = false;
  if (!config.options.layout) {
    config.options.layout = { padding: { top: 8, right: 12, bottom: 4, left: 4 } };
  }
  return config;
}
