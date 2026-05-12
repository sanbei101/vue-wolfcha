import { useGameStore } from "~/stores/game";
import type { Player, NightActions } from "~/types/game";
import { isWolfRole } from "~/types/game";

export function useGame() {
  const gameStore = useGameStore();

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
          const target = selectWolfTarget();
          if (target !== undefined) {
            actions[player.playerId] = { target };
          }
          break;
        }
        case "Seer": {
          const target = selectSeerTarget();
          if (target !== undefined) {
            actions[player.playerId] = { target };
          }
          break;
        }
        case "Witch": {
          const witchActions = selectWitchActions();
          actions[player.playerId] = witchActions;
          break;
        }
        case "Guard": {
          const target = selectGuardTarget();
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

  function selectSeerTarget(): number | undefined {
    const alivePlayers = gameStore.alivePlayers;

    // 随机查验一个玩家
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

  function selectGuardTarget(): number | undefined {
    const alivePlayers = gameStore.alivePlayers;
    const lastTarget = gameStore.nightActions.lastGuardTarget;

    // 排除上晚保护的人
    const available = alivePlayers.filter((p) => p.seat !== lastTarget);
    if (available.length === 0) return alivePlayers[0]?.seat;

    return available[Math.floor(Math.random() * available.length)]?.seat;
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
    // 模拟 AI 发言(实际项目中应调用 LLM API)
    const speeches = [
      "我认为这个位置的人有问题。",
      "大家小心狼人的伪装。",
      "我来分析一下局势。",
      "我建议先投死这个玩家。",
      "我没什么特别的想法。",
    ];

    return speeches[Math.floor(Math.random() * speeches.length)] || "我没什么特别的想法。";
  }

  // ============ 投票阶段 ============

  async function executeVote() {
    gameStore.setPhase("VOTE");

    // AI 玩家投票
    for (const player of gameStore.players) {
      if (!player.alive || player.isHuman) continue;

      const target = selectVoteTarget(player);
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
