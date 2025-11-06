// File: /api/feedback.js
// Purpose: Relay feedback to your Google Apps Script webhook
// Environment: Vercel Serverless Function (Node >=18)

const GAS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbwzqAJ13NLdpAxDtb5UYeenSRM8QO0_yrFGOP2gM_TvwE1woAaqgW-WyhxdNX64wMTC/exec";

/** Helper: read raw request body */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data || "{}"));
    req.on("error", reject);
  });
}

/** Minimal input sanitizer */
function sanitize(input) {
  const safe = {};
  safe.rating = typeof input?.rating === "number" ? input.rating : null;
  safe.category = typeof input?.category === "string" ? input.category.slice(0, 64) : "";
  safe.message = typeof input?.message === "string" ? input.message.slice(0, 2000) : "";
  safe.clientTime = typeof input?.clientTime === "string" ? input.clientTime : new Date().toISOString();
  safe.device = typeof input?.device === "string" ? input.device.slice(0, 256) : "";
  safe.version = typeof input?.version === "string" ? input.version.slice(0, 64) : "unknown";
  safe.stats =
    input?.stats && typeof input.stats === "object"
      ? {
          currentStreak: Number(input.stats.currentStreak || 0),
          longestStreak: Number(input.stats.longestStreak || 0),
          entriesThisWeek: Number(input.stats.entriesThisWeek || 0),
          entriesThisMonth: Number(input.stats.entriesThisMonth || 0),
          avgMood7d: Number(input.stats.avgMood7d || 0),
        }
      : {};
  return safe;
}

/** Main handler */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const raw = await getRawBody(req);
    const body = JSON.parse(raw || "{}");
    const safe = sanitize(body);

    if (safe.rating == null && !safe.message) {
      return res.status(400).json({ ok: false, error: "Missing rating or message" });
    }

    const relayPayload = {
      ...safe,
      serverTime: new Date().toISOString(),
      ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || "",
    };

    const gasResp = await fetch(GAS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(relayPayload),
    });

    // GAS responses don't always return JSON; ignore errors
    let gasText = "";
    try {
      gasText = await gasResp.text();
    } catch {}

    if (!gasResp.ok) {
      return res.status(502).json({ ok: false, error: "Upstream error", detail: gasText });
    }

    return res.status(200).json({ ok: true, relay: gasText.slice(0, 100) || "OK" });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: "Server error", detail: String(err?.message || err) });
  }
}
