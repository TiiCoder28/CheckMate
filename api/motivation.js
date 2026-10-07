const DEFAULT_MODEL = "inclusionai/ling-3.1-flash-free";

function sanitize(value, max = 160) {
  return String(value ?? "").replace(/[\r\n<>]/g, " ").trim().slice(0, max);
}

function fallback(input, quote) {
  const veryHeavy = input.mood <= 2 || input.energy <= 2 || input.stress >= 9;
  const heavy = veryHeavy || input.mood <= 3 || input.energy <= 3 || input.stress >= 8;

  if (veryHeavy) {
    return {
      message: "Today looks especially heavy. Productivity is not the priority right now; keeping yourself fed, hydrated, alcohol-free and connected to someone safe is enough for today.",
      action: "Pick one basic-care step, then tell one safe person you are having a difficult day.",
      source: quote ? "Daily quote + CheckMate low-capacity support" : "CheckMate low-capacity support"
    };
  }

  return {
    message: heavy
      ? "Today looks like a lower-capacity day. Make the goal smaller, protect your basics, and let three quiet wins be enough."
      : "You do not need to transform your life today. A few deliberate choices are enough to keep moving in the direction you want.",
    action: heavy
      ? "Choose the gentlest meaningful win: eat, move for ten minutes, rest, connect, or protect today's alcohol-free choice."
      : "Choose one useful task and give it twenty focused minutes.",
    source: quote ? `Daily quote: “${quote}”` : "CheckMate"
  };
}

async function fetchWithTimeout(url, ms = 2200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "CheckMate/1.0" }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function freshContext() {
  let quote = "";
  let headline = "";

  try {
    const response = await fetchWithTimeout("https://zenquotes.io/api/today");
    if (response.ok) {
      const data = await response.json();
      quote = sanitize(data?.[0]?.q, 180);
    }
  } catch (_) {}

  try {
    const response = await fetchWithTimeout("https://www.positive.news/feed/");
    if (response.ok) {
      const xml = await response.text();
      const item = xml.match(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>/i);
      headline = sanitize(
        (item?.[1] || "")
          .replace(/<!\[CDATA\[|\]\]>/g, "")
          .replace(/&amp;/g, "&"),
        180
      );
    }
  } catch (_) {}

  return { quote, headline };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const input = {
    mood: Math.max(1, Math.min(10, Number(req.body?.mood) || 5)),
    stress: Math.max(1, Math.min(10, Number(req.body?.stress) || 5)),
    energy: Math.max(1, Math.min(10, Number(req.body?.energy) || 5)),
    need: sanitize(req.body?.need, 120),
    alcoholFreeDays: Math.max(0, Math.min(5000, Number(req.body?.alcoholFreeDays) || 0)),
    completedAnchors: Array.isArray(req.body?.completedAnchors)
      ? req.body.completedAnchors.slice(0, 10).map(v => sanitize(v, 50))
      : [],
    wins: Array.isArray(req.body?.wins)
      ? req.body.wins.slice(0, 3).map(v => sanitize(v, 90))
      : []
  };

  const fresh = await freshContext();
  const fallbackResult = fallback(input, fresh.quote);
  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;

  if (!token) {
    return res.status(200).json(fallbackResult);
  }

  const prompt = `Create a short daily reset for a wellbeing and habit app called CheckMate.

This is supportive coaching, not therapy or medical advice.
Tone: warm, grounded, concise, never preachy, never guilt-based, never toxic positivity.
Do not diagnose. Do not say the person is failing. Do not praise suffering.
Return exactly two sections in plain text:
MESSAGE: 2 short sentences.
ACTION: one concrete action that takes under 30 minutes.

User check-in:
- mood: ${input.mood}/10
- stress: ${input.stress}/10
- energy: ${input.energy}/10
- what they need: ${input.need || "not specified"}
- alcohol-free streak: ${input.alcoholFreeDays} days
- completed anchors: ${input.completedAnchors.join(", ") || "none yet"}
- their three wins: ${input.wins.join(" | ") || "not set yet"}

Fresh internet context, use only if it naturally helps:
- daily quote: ${fresh.quote || "unavailable"}
- positive-news headline: ${fresh.headline || "unavailable"}

If mood is 2 or lower, or stress is 9 or higher, keep the action focused on basic care or human connection rather than productivity.`;

  try {
    const gateway = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content: "You write brief, compassionate, practical daily motivation for a wellbeing tracker."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 180,
        temperature: 0.6
      })
    });

    if (!gateway.ok) {
      return res.status(200).json(fallbackResult);
    }

    const data = await gateway.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const message = text.match(/MESSAGE:\s*([\s\S]*?)(?=\nACTION:|$)/i)?.[1]?.trim();
    const action = text.match(/ACTION:\s*([\s\S]*)/i)?.[1]?.trim();

    if (!message || !action) {
      return res.status(200).json(fallbackResult);
    }

    const sources = [];
    if (fresh.quote) sources.push("daily quote");
    if (fresh.headline) sources.push("positive news");
    sources.push("AI-personalised");

    return res.status(200).json({
      message: sanitize(message, 420),
      action: sanitize(action, 180),
      source: sources.join(" + ")
    });
  } catch (_) {
    return res.status(200).json(fallbackResult);
  }
}
