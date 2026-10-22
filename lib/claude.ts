// AI client (server-only). Works with either provider:
//  - OPENROUTER_API_KEY (preferred): OpenAI-style API at openrouter.ai; model from AI_MODEL,
//    with fallbacks so a retired model name doesn't break the app.
//  - ANTHROPIC_API_KEY: Claude Messages API directly.
// Content parts use one shape: {type:"text", text} | {type:"image", source:{media_type, data(base64)}}.

const OR_DEFAULT_MODELS = ["google/gemini-2.5-flash", "openai/gpt-4o-mini", "anthropic/claude-sonnet-4.5"];

// Use only the first token of a key, so stray text pasted into the env var can't break the header.
const cleanKey = (v?: string) => (v ?? "").trim().split(/\s+/)[0] || "";
const orKey = () => cleanKey(process.env.OPENROUTER_API_KEY);
const anKey = () => cleanKey(process.env.ANTHROPIC_API_KEY);
/** Remove anything that looks like an API key from text shown to users. */
export const redact = (t: string) => t.replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-…").replace(/Bearer\s+\S+/g, "Bearer …");

export const hasAI = () => !!(orKey() || anKey());
export const hasClaude = hasAI; // backwards-compatible name
export const aiProvider = () => (orKey() ? "openrouter" : anKey() ? "anthropic" : "none");

export async function callClaude(opts: { system: string; content: any[]; maxTokens?: number }): Promise<string> {
  try {
    return await (orKey() ? callOpenRouter(opts) : callAnthropic(opts));
  } catch (e: any) {
    throw new Error(redact(String(e?.message ?? e)));
  }
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
      authorization: `Bearer ${orKey()}`,
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
      "x-api-key": anKey(),
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
