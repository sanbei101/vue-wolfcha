type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GenerateOptions = {
  temperature?: number;
  maxTokens?: number;
};

export function useLLM() {
  async function generateCompletion(
    messages: LLMMessage[],
    options: GenerateOptions = {},
  ): Promise<string> {
    try {
      const response = (await $fetch("/api/chat", {
        method: "POST",
        body: {
          messages,
          temperature: options.temperature ?? 0.8,
          max_tokens: options.maxTokens ?? 2000,
        },
      })) as unknown as { content: string; raw: unknown };

      return response.content;
    } catch (err) {
      console.error("[useLLM] generateCompletion error:", err);
      throw err;
    }
  }

  async function generateSpeech(
    role: string,
    context: string,
    playerName: string,
  ): Promise<string> {
    const systemPrompt = `你是一个狼人杀游戏中的玩家 "${playerName}",角色是 ${role}。
    请根据游戏情境,生成符合角色性格的发言。
    发言要简洁、自然,符合狼人杀游戏的风格。
    不要输出任何标记或特殊格式,只输出发言内容。`;

    const userMessage = `当前游戏情境:${context}

    请生成玩家 "${playerName}" 的发言:`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    return generateCompletion(messages, {
      temperature: 0.8,
      maxTokens: 500,
    });
  }

  async function generateNightAction(role: string, gameState: string): Promise<string> {
    const systemPrompt = `你是一个狼人杀游戏中的玩家,角色是 ${role}。
    请根据当前游戏状态,选择你的夜晚行动。
    狼人:选择要击杀的目标(输出座位号)
    预言家:选择要查验的目标(输出座位号)
    女巫:决定是否救人或毒人(输出 save/poison/pass)
    守卫:选择要保护的目标(输出座位号)
    只输出数字或指令,不要其他内容。`;

    const userMessage = `当前游戏状态:${gameState}\n\n你的行动是:`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    return generateCompletion(messages, {
      temperature: 0.3,
      maxTokens: 100,
    });
  }

  async function generateVote(gameState: string, eligibleTargets: number[]): Promise<number> {
    const systemPrompt = `你是一个狼人杀游戏中的玩家。
    请根据当前游戏状态,选择要投票的目标。
    只输出座位号(数字),不要其他内容。`;

    const userMessage = `当前游戏状态:${gameState}
    可以投票的目标座位:${eligibleTargets.join(", ")}
    你的投票是(只输出数字):`;

    const messages: LLMMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const result = await generateCompletion(messages, {
      temperature: 0.3,
      maxTokens: 50,
    });

    // 解析座位号
    const match = result.match(/\d+/);
    if (match) {
      const seat = parseInt(match[0], 10) - 1; // 转换为 0-indexed
      if (eligibleTargets.includes(seat)) {
        return seat;
      }
    }

    // 默认返回第一个有效目标
    return eligibleTargets[0] ?? 0;
  }

  return {
    generateCompletion,
    generateSpeech,
    generateNightAction,
    generateVote,
  };
}
