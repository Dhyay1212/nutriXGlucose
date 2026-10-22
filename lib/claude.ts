// AI client (server-only). Works with either provider:
//  - OPENROUTER_API_KEY (preferred): OpenAI-style API at openrouter.ai; model from AI_MODEL,
//    with fallbacks so a retired model name doesn't break the app.
//  - ANTHROPIC_API_KEY: Claude Messages API directly.
// Content parts use one shape: {type:"text", text} | {type:"image", source:{media_type, data(base64)}}.

const OR_DEFAULT_MODELS = ["google/gemini-2.5-flash", "openai/gpt-4o-mini", "anthropic/claude-sonnet-4.5"];

export const hasAI = () => !!(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY);
export const hasClaude = hasAI; // backwards-compatible name
export const aiProvider = () => (process.env.OPENROUTER_API_KEY ? "openrouter" : process.env.ANTHROPIC_API_KEY ? "anthropic" : "none");

export async function callClaude(opts: { system: string; content: any[]; maxTokens?: number }): Promise<string> {
  return process.env.OPENROUTER_API_KEY ? callOpenRouter(opts) : callAnthropic(opts);
}

async function callOpenRouter(opts: { system: string; content: any[]; maxTokens?: number }): Promise<string> {
  const primary = process.env.AI_MODEL?.trim();
  const models = [...new Set([primary, ...OR_DEFAULT_MODELS].filter(Boolean))] as string[];
  const content = opts.content.map((c) =>
    c.type === "image"
      ? { type: "image_url", image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` } }
      : { type: "text", text: c.text }
  );
  const res = await fetch(`${process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.APP_URL || "https://nutrixglucose.vercel.app",
      "X-Title": "NutriX Glucose",
    },
    body: JSON.stringify({
      model: models[0],
      models, // OpenRouter tries these in order if one is unavailable
      max_tokens: opts.maxTokens ?? 1024,
      temperature: 0.2,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const msg = data.choices?.[0]?.message?.content;
  const text = Array.isArray(msg) ? msg.map((p: any) => p.text ?? "").join("\n") : String(msg ?? "");
  if (!text) throw new Error(`OpenRouter returned no text: ${JSON.stringify(data).slice(0, 300)}`);
  return text;
}

async function callAnthropic(opts: { system: string; content: any[]; maxTokens?: number }): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: [{ role: "user", content: opts.content }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
}

/** Pull the first JSON object/array out of a model reply. */
export function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[\[{]/);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (start < 0 || end < start) throw new Error("No JSON in model reply");
  return JSON.parse(raw.slice(start, end + 1));
}
