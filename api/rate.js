export default async function handler(req, res) {
  try {
    const url = "https://www.tax.gov.kh/en/exchange-rate";

    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (RateBot; +https://example.com)",
        "accept-language": "en-US,en;q=0.9"
      }
    });

    const html = await r.text();

    // Extract the first occurrence of a date + USD/KHR + rate number
    const rowRegex =
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}[\s\S]{0,600}?USD\/KHR[\s\S]{0,200}?(\d{3,5})/i;

    const m = html.match(rowRegex);
    if (!m) {
      res.status(502).json({ error: "RATE_PARSE_FAILED" });
      return;
    }

    const dateMatch = m[0].match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i
    );
    const date = dateMatch ? dateMatch[0] : "";

    const rate = parseInt(m[2], 10);
    if (!rate || rate < 1000 || rate > 10000) {
      res.status(502).json({ error: "RATE_INVALID" });
      return;
    }

    // Cache at edge for 1 hour; allow stale while revalidate for 1 day
    res.setHeader("cache-control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json({
      source: "GDT (Official daily rate published by NBC)",
      date,
      usd_khr: rate
    });
  } catch (e) {
    res.status(500).json({ error: "SERVER_ERROR" });
  }
}
