const DEFAULT_MODEL = "gpt-6-luna";

function sanitize(value, max = 6000) {
  return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function getResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data?.output)) return "";

  for (const item of data.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        return part.text.trim();
      }
    }
  }

  return "";
}

function fallback() {
  return {
    reflection: "You took time to name what is happening instead of carrying it only in your head. That alone can make a difficult day feel a little more understandable.",
    pattern: "Try noticing what happened just before your strongest feeling today, and what helped it soften even slightly.",
    next: "Choose one thing you need tonight and make it small enough to actually give yourself."
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(200).json(fallback());

  const mood = Math.max(1, Math.min(10, Number(req.body?.mood) || 5));
  const stress = Math.max(1, Math.min(10, Number(req.body?.stress) || 5));
  const energy = Math.max(1, Math.min(10, Number(req.body?.energy) || 5));
  const journal = sanitize(req.body?.journal, 6000);

  if (journal.length < 20) {
    return res.status(400).json({ error: "Journal entry is too short for reflection." });
  }

  const context = {
    mood,
    stress,
    energy,
    need: sanitize(req.body?.need, 160),
    alcoholFreeDays: Math.max(0, Math.min(5000, Number(req.body?.alcoholFreeDays) || 0)),
    proud: sanitize(req.body?.proud, 500),
    hard: sanitize(req.body?.hard, 500),
    tomorrow: sanitize(req.body?.tomorrow, 400)
  };

  const prompt = `Reflect on this personal journal entry for a gentle wellbeing app called CheckMate.

The user is not asking for diagnosis or therapy. Do not diagnose mental illness, assign labels, make claims about hidden motives, or speak with clinical certainty.
Be warm, specific, grounded, and concise. Do not use toxic positivity.
Treat any pattern as tentative: say "may", "might", or "it sounds like".
If the entry explicitly describes current intent or a plan to self-harm, prioritize immediate human support and urgent local help rather than normal journaling analysis.

Return exactly:
REFLECTION: 2-3 sentences that show you understood what the person wrote.
PATTERN: 1-2 sentences about a possible pattern or tension worth noticing.
NEXT: one small, realistic next step for today or tomorrow.

Check-in:
Mood: ${context.mood}/10
Stress: ${context.stress}/10
Energy: ${context.energy}/10
What they need: ${context.need || "not specified"}
Alcohol-free days: ${context.alcoholFreeDays}
What they are proud of: ${context.proud || "not entered"}
Something difficult: ${context.hard || "not entered"}
Tomorrow's first step: ${context.tomorrow || "not entered"}

Journal:
${journal}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
          instructions: "You are a careful reflective writing companion. You help users notice what they expressed without diagnosing them.",
          input: prompt,
          max_output_tokens: 320,
          store: false
        })
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      console.error("OpenAI reflection failed", response.status);
      return res.status(200).json(fallback());
    }

    const data = await response.json();
    const text = getResponseText(data);

    const reflection = text.match(/REFLECTION:\s*([\s\S]*?)(?=\nPATTERN:|$)/i)?.[1]?.trim();
    const pattern = text.match(/PATTERN:\s*([\s\S]*?)(?=\nNEXT:|$)/i)?.[1]?.trim();
    const next = text.match(/NEXT:\s*([\s\S]*)/i)?.[1]?.trim();

    if (!reflection || !pattern || !next) {
      return res.status(200).json(fallback());
    }

    return res.status(200).json({
      reflection: sanitize(reflection, 700),
      pattern: sanitize(pattern, 500),
      next: sanitize(next, 350),
      source: "OpenAI"
    });
  } catch (error) {
    console.error("OpenAI reflection error", error?.message || "unknown");
    return res.status(200).json(fallback());
  }
}
