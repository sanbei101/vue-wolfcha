import { defineEventHandler, readBody, createError } from "h3";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
};

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

  console.log("[chat API] Request messages:", JSON.stringify(body.messages, null, 2));

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: body.messages,
      thinking: { type: "enabled" },
      reasoning_effort: "high",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[chat API] Error:", response.status, errorText);
    throw createError({
      statusCode: 500,
      statusMessage: `DeepSeek API error: ${response.status} - ${errorText}`,
    });
  }

  const result = (await response.json()) as {
    choices: Array<{
      message: {
        content: string;
        reasoning_content: string;
      };
    }>;
  };

  const choice = result.choices?.[0]?.message;
  const content = choice?.content || "";
  const reasoning_content = choice?.reasoning_content || "";

  console.log("[chat API] Response:", JSON.stringify({ content, reasoning_content }, null, 2));

  return {
    content,
    reasoning_content,
  };
});
