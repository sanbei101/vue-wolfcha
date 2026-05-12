import { defineEventHandler, readBody, createError } from "h3";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
};

type ChatResponse = {
  content: string;
  reasoning_details?: unknown;
  raw: unknown;
};

// 处理响应内容，移除 markdown 代码块
function processResponse(content: string): string {
  return content
    .replace(/^```(?:json|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// 调用 DeepSeek API
async function callDeepSeekApi(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  temperature: number,
  maxTokens?: number,
): Promise<{ content: string; reasoning_details?: unknown }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens ?? 2000,
        thinking: { type: "enabled" },
        reasoning_effort: "high",
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const result = (await response.json()) as {
      choices: Array<{
        message: {
          content: string;
          reasoning_details?: unknown;
        };
        finish_reason: string;
      }>;
    };

    const choice = result.choices?.[0];
    if (!choice?.message) {
      throw new Error("No response from DeepSeek");
    }

    return {
      content: choice.message.content || "",
      reasoning_details: choice.message.reasoning_details,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const body = await readBody<ChatRequest>(event);

  if (!body.messages || !Array.isArray(body.messages)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request: messages is required",
    });
  }

  const apiKey = config.deepseekApiKey;
  const baseUrl = config.public.deepseekBaseUrl;
  const model = config.public.deepseekModel;

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "DeepSeek API key not configured",
    });
  }

  try {
    const result = await callDeepSeekApi(
      apiKey,
      baseUrl,
      body.model || model,
      body.messages,
      body.temperature ?? 0.8,
      body.max_tokens,
    );

    return {
      content: processResponse(result.content),
      reasoning_details: result.reasoning_details,
      raw: result,
    } satisfies ChatResponse;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[chat API] Error:", errorMessage);

    throw createError({
      statusCode: 500,
      statusMessage: `LLM API error: ${errorMessage}`,
    });
  }
});
