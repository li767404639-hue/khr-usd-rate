// api/rate.js
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    // 使用稳定 JSON 源：USD -> KHR
    const url = "https://open.er-api.com/v6/latest/USD";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);

    const r = await fetch(url, {
      signal: controller.signal,
      headers: { "accept": "application/json" }
    });

    clearTimeout(timer);

    if (!r.ok) {
      return res.status(502).json({ error: "RATE_FETCH_FAILED", status: r.status });
    }

    const data = await r.json();
    const khr = data?.rates?.KHR;

    if (!khr || typeof khr !== "number") {
      return res.status(502).json({ error: "RATE_BAD_RESPONSE" });
    }

    // 给前端的 date 字段：简单可用
    const date =
      (typeof data?.time_last_update_utc === "string" && data.time_last_update_utc.slice(5, 16)) ||
      new Date().toISOString().slice(0, 10);

    return res.status(200).json({
      usd_khr: Math.round(khr),
      date
    });
  } catch (e) {
    // 兜底：避免前端卡 Loading
    return res.status(200).json({
      usd_khr: 4100,
      date: new Date().toISOString().slice(0, 10),
      fallback: true,
      error: "RATE_RUNTIME_ERROR"
    });
  }
}
