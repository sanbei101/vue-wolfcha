import { defineEventHandler, readBody } from "h3";

type LLMProvider = "zenmux" | "dashscope" | "newapi";

type ModelRef = {
  provider: LLMProvider;
  model: string;
  temperature?: number;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  stream?: boolean;
};

type ChatResponse = {
  content: string;
  raw: unknown;
};

// 简单的消息处理
function processResponse(content: string): string {
  // 移除 markdown 代码块标记
  return content
    .replace(/^```(?:json|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ChatRequest>(event);

  if (!body.messages || !Array.isArray(body.messages)) {
    throw createError({
      statusCode: 400,
      message: "Invalid request: messages is required",
    });
  }

  // 获取配置
  const config = useRuntimeConfig();
  const apiKey = config.zemuxApiKey || process.env.ZENMUX_API_KEY;
  const baseUrl = config.zemuxBaseUrl || "https://api.zenmux.com";

  if (!apiKey) {
    // 如果没有 API key,返回模拟响应
    return {
      content: generateMockResponse(body.messages),
      raw: {},
    } satisfies ChatResponse;
  }

  try {
    const response = await $fetch<{
      choices: Array<{ message: { content: string } }>;
    }>(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        model: body.model || "deepseek/deepseek-v3.2",
        messages: body.messages,
        temperature: body.temperature ?? 0.8,
        stream: false,
      },
    });

    const content = response.choices?.[0]?.message?.content || "";

    return {
      content: processResponse(content),
      raw: response,
    } satisfies ChatResponse;
  } catch (err) {
    // 错误处理
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[chat API] Error:", errorMessage);

    throw createError({
      statusCode: 500,
      message: `LLM API error: ${errorMessage}`,
    });
  }
});

function generateMockResponse(messages: ChatMessage[]): string {
  // 获取最后一条用户消息
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  if (!lastUserMessage) {
    return "(沉默...)";
  }

  // 简单的模拟响应
  const responses = [
    "让我想想...",
    "这个观点很有趣。",
    "我同意你的看法。",
    "我们需要仔细分析局势。",
    "我认为应该先观察一下。",
    "让我发表一下我的看法。",
    "根据目前的线索...",
    "这个玩家可能有问题。",
  ];

  return responses[Math.floor(Math.random() * responses.length)] || "(沉默...)";
}
