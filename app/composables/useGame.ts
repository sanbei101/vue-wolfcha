import { useGameStore } from "~/stores/game";
import type { Player, NightActions } from "~/types/game";
import { isWolfRole } from "~/types/game";

import { useLLM } from "./useLLM";

export function useGame() {
  const gameStore = useGameStore();
  const { generateSpeech, generateNightAction, generateVote } = useLLM();

  // ============ 游戏控制 ============

  function startGame(options: { playerCount: number; humanName: string }) {
    gameStore.startGame(options);
  }

  function resetGame() {
    gameStore.reset();
  }

  // ============ 夜晚行动 ============

  async function executeNightActions() {
    const actions = await generateNightActions();

    // 应用 AI 行动
    for (const [playerId, action] of Object.entries(actions)) {
      const player = gameStore.players.find((p) => p.playerId === playerId);
      if (!player || !player.alive) continue;

      switch (player.role) {
        case "Werewolf":
          gameStore.setNightAction({ wolfTarget: action.target });
          break;
        case "Seer":
          if (action.target !== undefined) {
            gameStore.setNightAction({ seerTarget: action.target });
            const targetPlayer = gameStore.players.find((p) => p.seat === action.target);
            if (targetPlayer) {
              gameStore.setNightAction({
                seerResult: {
                  targetSeat: action.target,
                  isWolf: isWolfRole(targetPlayer.role),
                },
              });
            }
          }
          break;
        case "Witch":
          if (action.witchSave !== undefined) {
            gameStore.setNightAction({ witchSave: action.witchSave });
          }
          if (action.witchPoison !== undefined) {
            gameStore.setNightAction({ witchPoison: action.witchPoison });
          }
          break;
        case "Guard":
          if (action.target !== undefined) {
            gameStore.setNightAction({ guardTarget: action.target });
          }
          break;
      }
    }

    // 结算夜晚
    const deaths = gameStore.resolveNight();

    // 报告死亡
    if (deaths.length > 0) {
      const names = deaths
        .map((d) => {
          const p = gameStore.players.find((pl) => pl.seat === d.seat);
          return p?.displayName;
        })
        .filter(Boolean)
        .join("、");

      gameStore.addSystemMessage(`昨夜死亡: ${names}`);
    } else {
      gameStore.addSystemMessage("昨夜是平安夜");
    }

    return deaths;
  }

  // ============ AI 行动生成 ============

  async function generateNightActions(): Promise<
    Record<
      string,
      {
        target?: number;
        witchSave?: boolean;
        witchPoison?: number;
      }
    >
  > {
    const actions: Record<
      string,
      {
        target?: number;
        witchSave?: boolean;
        witchPoison?: number;
      }
    > = {};

    for (const player of gameStore.players) {
      if (!player.alive || player.isHuman) continue;

      switch (player.role) {
        case "Werewolf": {
          const target = await selectWolfTargetWithLLM();
          if (target !== undefined) {
            actions[player.playerId] = { target };
          }
          break;
        }
        case "Seer": {
          const target = await selectSeerTargetWithLLM();
          if (target !== undefined) {
            actions[player.playerId] = { target };
          }
          break;
        }
        case "Witch": {
          const witchActions = await selectWitchActionsWithLLM();
          actions[player.playerId] = witchActions;
          break;
        }
        case "Guard": {
          const target = await selectGuardTargetWithLLM();
          if (target !== undefined) {
            actions[player.playerId] = { target };
          }
          break;
        }
      }
    }

    return actions;
  }

  function selectWolfTarget(): number | undefined {
    const alivePlayers = gameStore.alivePlayers;
    const wolves = gameStore.aliveWolves;

    if (alivePlayers.length === 0) return undefined;

    // 优先选择非狼人玩家
    const nonWolves = alivePlayers.filter((p) => !isWolfRole(p.role));
    if (nonWolves.length > 0) {
      return nonWolves[Math.floor(Math.random() * nonWolves.length)]?.seat;
    }

    // 如果全是狼人,随机选择
    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)]?.seat;
  }

  async function selectWolfTargetWithLLM(): Promise<number | undefined> {
    const alivePlayers = gameStore.alivePlayers;
    const wolves = gameStore.aliveWolves;

    if (alivePlayers.length === 0) return undefined;

    const nonWolves = alivePlayers.filter((p) => !isWolfRole(p.role));
    const targets = nonWolves.length > 0 ? nonWolves : alivePlayers;

    const gameState = buildGameStateForNight("Werewolf");
    const result = await generateNightAction("狼人", gameState);

    // 解析座位号
    const seatNum = parseInt(result.trim(), 10);
    if (!isNaN(seatNum) && seatNum >= 1 && seatNum <= gameStore.players.length) {
      const seatIndex = seatNum - 1;
      const player = gameStore.players.find((p) => p.seat === seatIndex);
      if (player && player.alive && targets.some((t) => t.seat === seatIndex)) {
        return seatIndex;
      }
    }

    // 默认随机选择
    return targets[Math.floor(Math.random() * targets.length)]?.seat;
  }

  function selectSeerTarget(): number | undefined {
    const alivePlayers = gameStore.alivePlayers;

    // 随机查验一个玩家
    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)]?.seat;
  }

  async function selectSeerTargetWithLLM(): Promise<number | undefined> {
    const alivePlayers = gameStore.alivePlayers;
    if (alivePlayers.length === 0) return undefined;

    const gameState = buildGameStateForNight("Seer");
    const result = await generateNightAction("预言家", gameState);

    const seatNum = parseInt(result.trim(), 10);
    if (!isNaN(seatNum) && seatNum >= 1 && seatNum <= gameStore.players.length) {
      const seatIndex = seatNum - 1;
      const player = gameStore.players.find((p) => p.seat === seatIndex);
      if (player && player.alive) {
        return seatIndex;
      }
    }

    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)]?.seat;
  }

  function selectWitchActions(): { witchSave?: boolean; witchPoison?: number } {
    const result: { witchSave?: boolean; witchPoison?: number } = {};
    const wolfTarget = gameStore.nightActions.wolfTarget;

    // 如果狼人刀了人且女巫有解药,50%概率救人
    if (wolfTarget !== undefined && !gameStore.roleAbilities.witchHealUsed) {
      result.witchSave = Math.random() > 0.5;
    }

    // 如果有狼人目标,30%概率毒人
    if (wolfTarget !== undefined && !gameStore.roleAbilities.witchPoisonUsed) {
      const wolves = gameStore.aliveWolves;
      if (wolves.length > 0 && Math.random() > 0.7) {
        result.witchPoison = wolves[Math.floor(Math.random() * wolves.length)]?.seat;
      }
    }

    return result;
  }

  async function selectWitchActionsWithLLM(): Promise<{
    witchSave?: boolean;
    witchPoison?: number;
  }> {
    const result: { witchSave?: boolean; witchPoison?: number } = {};
    const wolfTarget = gameStore.nightActions.wolfTarget;

    const gameState = buildGameStateForNight("Witch");
    const actionResult = await generateNightAction("女巫", gameState);

    // 解析女巫行动
    const lowerResult = actionResult.toLowerCase().trim();
    if (lowerResult === "save" || lowerResult === "救") {
      if (wolfTarget !== undefined && !gameStore.roleAbilities.witchHealUsed) {
        result.witchSave = true;
      }
    } else if (lowerResult === "pass" || lowerResult === "过") {
      // 不救人
    } else {
      // 尝试解析座位号(可能是毒人)
      const seatNum = parseInt(actionResult.trim(), 10);
      if (!isNaN(seatNum) && seatNum >= 1 && seatNum <= gameStore.players.length) {
        const seatIndex = seatNum - 1;
        const player = gameStore.players.find((p) => p.seat === seatIndex);
        if (player && player.alive && !gameStore.roleAbilities.witchPoisonUsed) {
          result.witchPoison = seatIndex;
        }
      }
    }

    // 如果狼人刀了人且女巫有解药,50%概率救人
    if (
      wolfTarget !== undefined &&
      !gameStore.roleAbilities.witchHealUsed &&
      result.witchSave === undefined
    ) {
      result.witchSave = Math.random() > 0.5;
    }

    return result;
  }

  function selectGuardTarget(): number | undefined {
    const alivePlayers = gameStore.alivePlayers;
    const lastTarget = gameStore.nightActions.lastGuardTarget;

    // 排除上晚保护的人
    const available = alivePlayers.filter((p) => p.seat !== lastTarget);
    if (available.length === 0) return alivePlayers[0]?.seat;

    return available[Math.floor(Math.random() * available.length)]?.seat;
  }

  async function selectGuardTargetWithLLM(): Promise<number | undefined> {
    const alivePlayers = gameStore.alivePlayers;
    const lastTarget = gameStore.nightActions.lastGuardTarget;

    const available = alivePlayers.filter((p) => p.seat !== lastTarget);
    const targets = available.length > 0 ? available : alivePlayers;

    if (targets.length === 0) return undefined;

    const gameState = buildGameStateForNight("Guard");
    const result = await generateNightAction("守卫", gameState);

    const seatNum = parseInt(result.trim(), 10);
    if (!isNaN(seatNum) && seatNum >= 1 && seatNum <= gameStore.players.length) {
      const seatIndex = seatNum - 1;
      const player = gameStore.players.find((p) => p.seat === seatIndex);
      if (player && player.alive && targets.some((t) => t.seat === seatIndex)) {
        return seatIndex;
      }
    }

    return targets[Math.floor(Math.random() * targets.length)]?.seat;
  }

  // ============ 发言阶段 ============

  async function executeDaySpeech() {
    gameStore.setPhase("SPEECH");
    gameStore.startDaySpeech();

    while (gameStore.phase === "SPEECH" && gameStore.currentSpeakerSeat !== null) {
      const speaker = gameStore.currentSpeaker;

      if (!speaker) break;

      if (speaker.isHuman) {
        // 等待人类输入
        return { waitingForHuman: true, playerId: speaker.playerId };
      }

      // AI 发言
      const speech = await generateAISpeech(speaker);
      gameStore.addPlayerMessage(speaker.playerId, speech);

      // 下一位发言者
      gameStore.nextSpeaker();
    }

    return { waitingForHuman: false };
  }

  async function generateAISpeech(player: Player): Promise<string> {
    const context = buildSpeechContext();
    return generateSpeech(player.role, context, player.displayName);
  }

  function buildSpeechContext(): string {
    const alivePlayers = gameStore.players.filter((p) => p.alive);
    const messages = gameStore.messages.slice(-20); // 最近 20 条消息

    let context = "【存活玩家】\n";
    alivePlayers.forEach((p) => {
      context += `${p.seat + 1}号位: ${p.displayName} (${p.role})\n`;
    });

    context += "\n【最近发言】\n";
    messages.forEach((msg) => {
      if (msg.isSystem) {
        context += `[系统]: ${msg.content}\n`;
      } else {
        const player = gameStore.players.find((p) => p.playerId === msg.playerId);
        context += `${player?.displayName}: ${msg.content}\n`;
      }
    });

    return context;
  }

  // ============ 投票阶段 ============

  async function executeVote() {
    gameStore.setPhase("VOTE");

    // AI 玩家投票
    for (const player of gameStore.players) {
      if (!player.alive || player.isHuman) continue;

      const target = await selectVoteTargetWithLLM(player);
      gameStore.castVote(player.playerId, target);
    }

    // 结算投票
    const result = gameStore.resolveVote();

    if (result === null) {
      gameStore.addSystemMessage("投票平票,无人出局");
      gameStore.setPhase("SPEECH");
      gameStore.startDaySpeech();
    } else {
      const player = gameStore.players.find((p) => p.seat === result);
      gameStore.addSystemMessage(`${player?.displayName || "未知"}被投票出局`);

      // 检查猎人
      if (player?.role === "Hunter") {
        gameStore.setPhase("HUNTER_SHOOT");
        // 自动猎人开枪(简化:随机选择)
        const target = selectHunterTarget();
        if (target !== null) {
          gameStore.hunterShoot(target);
          const victim = gameStore.players.find((p) => p.seat === target);
          gameStore.addSystemMessage(`猎人开枪,带走了${victim?.displayName || "未知"}`);
        }
      }
    }

    return result;
  }

  function selectVoteTarget(voter: Player): number {
    const alivePlayers = gameStore.alivePlayers.filter((p) => p.playerId !== voter.playerId);

    if (alivePlayers.length === 0) return 0;
    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)]?.seat ?? 0;
  }

  async function selectVoteTargetWithLLM(voter: Player): Promise<number> {
    const alivePlayers = gameStore.alivePlayers.filter((p) => p.playerId !== voter.playerId);
    const eligibleTargets = alivePlayers.map((p) => p.seat);

    if (eligibleTargets.length === 0) return 0;

    const gameState = buildVoteContext(voter);
    const result = await generateVote(gameState, eligibleTargets);

    return result;
  }

  function buildVoteContext(voter: Player): string {
    const alivePlayers = gameStore.players.filter((p) => p.alive);
    const messages = gameStore.messages.slice(-30);

    let context = `【投票玩家】${voter.displayName} (${voter.role})\n\n`;
    context += "【存活玩家】\n";
    alivePlayers.forEach((p) => {
      const isVoter = p.playerId === voter.playerId;
      context += `${p.seat + 1}号位: ${p.displayName} (${p.role})${isVoter ? " [自己]" : ""}\n`;
    });

    context += "\n【发言记录】\n";
    messages.forEach((msg) => {
      if (msg.isSystem) {
        context += `[系统]: ${msg.content}\n`;
      } else {
        const player = gameStore.players.find((p) => p.playerId === msg.playerId);
        context += `${player?.displayName}: ${msg.content}\n`;
      }
    });

    return context;
  }

  function selectHunterTarget(): number | null {
    const alivePlayers = gameStore.alivePlayers;

    if (alivePlayers.length === 0) return null;

    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)]?.seat ?? null;
  }

  // ============ 胜负判断 ============

  function checkAndEndGame() {
    const winner = gameStore.checkWinCondition();

    if (winner) {
      gameStore.setPhase("GAME_OVER");
      gameStore.winner = winner;

      if (winner === "village") {
        gameStore.addSystemMessage("村民胜利!");
      } else {
        gameStore.addSystemMessage("狼人胜利!");
      }
    }

    return winner;
  }

  return {
    // 游戏控制
    startGame,
    resetGame,

    // 夜晚
    executeNightActions,

    // 白天
    executeDaySpeech,

    // 投票
    executeVote,

    // 胜负
    checkAndEndGame,
  };
}

function buildGameStateForNight(role: string): string {
  const store = useGameStore();
  const alivePlayers = store.players.filter((p) => p.alive);

  let state = `【角色】${role}\n\n`;
  state += "【存活玩家】\n";
  alivePlayers.forEach((p) => {
    state += `${p.seat + 1}号位: ${p.displayName} (${p.role})\n`;
  });

  // 夜晚已知信息
  if (role === "Seer" && store.seerResults.length > 0) {
    state += "\n【查验结果】\n";
    store.seerResults.forEach((r: { targetSeat: number; isWolf: boolean }) => {
      const player = store.players.find((p) => p.seat === r.targetSeat);
      const playerName = player?.displayName || `${r.targetSeat + 1}号`;
      state += `${playerName}: ${r.isWolf ? "狼人" : "好人"}\n`;
    });
  }

  if (role === "Witch") {
    state += `\n【药剂状态】`;
    state += `\n解药: ${store.roleAbilities.witchHealUsed ? "已使用" : "可用"}`;
    state += `\n毒药: ${store.roleAbilities.witchPoisonUsed ? "已使用" : "可用"}`;

    if (store.nightActions.wolfTarget !== undefined) {
      const target = store.players.find((p) => p.seat === store.nightActions.wolfTarget);
      state += `\n\n【狼人今晚要杀】${target?.displayName || `${store.nightActions.wolfTarget + 1}号`}`;
    }
  }

  if (role === "Guard") {
    state += `\n【连续保护】`;
    state += `\n昨晚保护: ${store.nightActions.lastGuardTarget !== undefined ? `${store.nightActions.lastGuardTarget + 1}号` : "无"}`;
  }

  return state;
}
