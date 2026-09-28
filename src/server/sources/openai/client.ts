import { postJson } from "../../http/fetchJson.ts";
import { config } from "../../config.ts";

interface ChatCompletionResponse {
  choices: { message: { content: string } }[];
}

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatComplete(
  messages: ChatCompletionMessage[],
  opts: { model?: string; temperature?: number } = {},
): Promise<string> {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");
  const res = await postJson<ChatCompletionResponse>("https://api.openai.com/v1/chat/completions", {
    headers: { Authorization: `Bearer ${config.openaiApiKey}` },
    body: {
      model: opts.model ?? config.openaiModel,
      messages,
      temperature: opts.temperature ?? 0.4,
    },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI response had no content");
  return content;
}
