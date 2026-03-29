const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// 한국어 주석: .env 파일을 단순 파싱해 환경변수로 로드
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const API_KEY = process.env.ALPHA_VANTAGE_KEY || "";
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const MIN_REQUEST_INTERVAL_MS = 1100;
let lastRequestTime = 0;
let requestChain = Promise.resolve();

const cache = new Map();

function cacheKey(symbol, range, startStr, endStr) {
  return `${symbol}:${range}:${startStr || ""}:${endStr || ""}`;
}

function cacheGet(symbol, range, startStr, endStr) {
  const entry = cache.get(cacheKey(symbol, range, startStr, endStr));
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL_MS) {
    cache.delete(cacheKey(symbol, range, startStr, endStr));
    return null;
  }
  return entry.data;
}

function cacheSet(symbol, range, startStr, endStr, data) {
  cache.set(cacheKey(symbol, range, startStr, endStr), { time: Date.now(), data });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleRequest(task) {
  // 한국어 주석: Alpha Vantage 무료 레이트리밋(초당 1회) 대응용 큐
  requestChain = requestChain.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - (now - lastRequestTime));
    if (wait) await delay(wait);
    lastRequestTime = Date.now();
    return task();
  });
  return requestChain;
}

function isPremiumMessage(message) {
  return /premium endpoint/i.test(message);
}

function requestAlphaVantageSeries(symbol, fnName, outputsize) {
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", fnName);
  url.searchParams.set("symbol", symbol);
  if (outputsize) {
    url.searchParams.set("outputsize", outputsize);
  }
  url.searchParams.set("apikey", API_KEY);

  return scheduleRequest(
    () =>
      new Promise((resolve, reject) => {
        https.get(url, (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              const data = JSON.parse(body);
              if (data["Error Message"]) return reject(new Error("Invalid ticker or API error."));
              const info = data["Information"] || data["Note"];
              if (info) {
                const err = new Error(info);
                if (isPremiumMessage(info)) err.code = "PREMIUM_ENDPOINT";
                return reject(err);
              }

          const seriesKey =
            fnName === "TIME_SERIES_DAILY"
              ? "Time Series (Daily)"
              : fnName === "TIME_SERIES_WEEKLY"
                ? "Weekly Time Series"
                : fnName === "TIME_SERIES_MONTHLY"
                  ? "Monthly Time Series"
                  : "Time Series (Daily)";
          const series = data[seriesKey];
              if (!series) return reject(new Error("No time series data returned."));

              const normalized = Object.keys(series)
                .map((dateStr) => {
                  const row = series[dateStr];
                  return {
                    t: dateStr,
                    o: Number(row["1. open"]),
                    h: Number(row["2. high"]),
                    l: Number(row["3. low"]),
                    c: Number(row["5. adjusted close"] || row["4. close"]),
                    v: Number(row["6. volume"] || 0)
                  };
                })
                .sort((a, b) => new Date(a.t) - new Date(b.t));

              resolve(normalized);
            } catch (err) {
              reject(err);
            }
          });
        }).on("error", reject);
      })
  );
}

function determineSeriesConfig(range, startStr, endStr) {
  let interval = "daily";
  if (range === "CUSTOM" && startStr && endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    interval = diffDays <= 120 ? "daily" : "weekly";
  } else if (range === "1M") {
    interval = "daily";
  } else {
    interval = "weekly";
  }

  if (interval === "daily") {
    return { fnName: "TIME_SERIES_DAILY", interval: "daily", outputsize: "compact" };
  }
  if (interval === "weekly") {
    return { fnName: "TIME_SERIES_WEEKLY", interval: "weekly" };
  }
  return { fnName: "TIME_SERIES_MONTHLY", interval: "monthly" };
}

// 한국어 주석: Alpha Vantage 무료 데이터 호출 (기간에 따라 일간/주간 선택)
function fetchAlphaVantageDaily(symbol, range, startStr, endStr) {
  const cached = cacheGet(symbol, range, startStr, endStr);
  if (cached) return Promise.resolve(cached);
  if (!API_KEY) return Promise.reject(new Error("Server missing API key."));

  const config = determineSeriesConfig(range, startStr, endStr);
  return requestAlphaVantageSeries(symbol, config.fnName, config.outputsize).then((series) => {
    const payload = { series, interval: config.interval };
    cacheSet(symbol, range, startStr, endStr, payload);
    return payload;
  });
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(body);
}

function handleApiPrice(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const symbol = (url.searchParams.get("symbol") || "").toUpperCase().trim();
  const range = (url.searchParams.get("range") || "1Y").toUpperCase();
  const startStr = url.searchParams.get("start") || "";
  const endStr = url.searchParams.get("end") || "";
  if (!symbol || !/^[A-Z0-9.\-]+$/.test(symbol)) {
    sendJson(res, 400, { error: "Invalid or missing symbol." });
    return;
  }

  fetchAlphaVantageDaily(symbol, range, startStr, endStr)
    .then((result) => {
      sendJson(res, 200, { symbol, source: "alpha_vantage", interval: result.interval, series: result.series });
    })
    .catch((err) => {
      sendJson(res, 502, { error: err.message || "Upstream data error." });
    });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
  };
  return map[ext] || "application/octet-stream";
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(safePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(safePath) });
    fs.createReadStream(safePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/price")) {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }
    handleApiPrice(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
