import OpenAI from "openai";

export const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    "X-Title": "Survey Pipeline Simulator",
  },
});

export async function generateCompletion(messages, options = {}) {
  const primaryModel = options.model || process.env.DEFAULT_AI_MODEL || "google/gemini-2.5-flash";
  const fallbackModel = process.env.FALLBACK_AI_MODEL || "meta-llama/llama-3.3-70b-instruct";

  try {
    return await openrouter.chat.completions.create({
      model: primaryModel,
      messages,
      temperature: options.temperature ?? 0.3,
      response_format: options.response_format || { type: "json_object" },
    });
  } catch (error) {
    if (error.status === 429 || error.status >= 500) {
      console.warn(`Primary model ${primaryModel} failed (${error.status}). Retrying with ${fallbackModel}...`);
      return await openrouter.chat.completions.create({
        model: fallbackModel,
        messages,
        temperature: options.temperature ?? 0.3,
        response_format: options.response_format || { type: "json_object" },
      });
    }
    throw error;
  }
}
