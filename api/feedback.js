// File: /api/feedback.js
// Purpose: Relays lightweight feedback to your Google Apps Script webhook
// Deploy target: Vercel Serverless Function (Node >=18; native fetch available)

const GAS_WEBHOOK =
  "https://script.google.com/macros/s/AKfycbwzqAJ13NLdpAxDtb5UYeenSRM8QO0_yrFGOP2gM_TvwE1woAaqgW-WyhxdNX64wMTC/exec";

/**
 * Minimal schema guard
 */
function sanitize(input) {
  const safe = {};
  safe.rating = typeof input?.rating === "number" ? input.rating : null; // 1..5
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
      : undefined;

  return safe;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = await (async () => {
      // Support both raw JSON and form-encoded just in case
      if (req.headers["content-type"]?.includes("application/json")) {
        return req.body && typeof req.body === "object" ? req.body : JSON.parse(await getRawBody(req));
      }
      return JSON.parse(await getRawBody(req));
    })();

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

    const resp = await fetch(GAS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(relayPayload),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return res.status(502).json({ ok: false, error: "Upstream error", detail: text });
    }

    // Optional: parse GAS response if it returns JSON
    let data = null;
    try {
      data = await resp.json();
    } catch {
      data = { statusText: await resp.text().catch(() => "ok") };
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Server error", detail: String(err?.message || err) });
  }
}

/** Read raw body helper */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data || "{}"));
    req.on("error", reject);
  });
}
