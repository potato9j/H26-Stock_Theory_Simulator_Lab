// 한국어 주석: 백엔드 프록시 API 호출
export async function fetchPriceSeries(symbol, range, start, end) {
  const params = new URLSearchParams({
    symbol: symbol,
    range: range || "1Y"
  });
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  const res = await fetch(`/api/price?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch data.");
  }
  return {
    series: data.series || [],
    interval: data.interval || "daily"
  };
}
