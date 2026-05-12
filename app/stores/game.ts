import { defineStore } from "pinia";
import { v4 as uuidv4 } from "uuid";

import type {
  GameState,
  Phase,
  Player,
  ChatMessage,
  NightActions,
  Alignment,
  DeathReason,
} from "~/types/game";
import { ROLE_CONFIG, getAlignment, isWolfRole } from "~/types/game";

// ============ 初始状态 ============

function createInitialState(): GameState {
  return {
    gameId: uuidv4(),
    phase: "LOBBY",
    day: 0,
    players: [],
    messages: [],
    events: [],
    currentSpeakerSeat: null,
    nightActions: {},
    roleAbilities: {
      witchHealUsed: false,
      witchPoisonUsed: false,
      hunterCanShoot: true,
    },
    votes: {},
    deaths: [],
    winner: null,
  };
}

// ============ 洗牌函数 ============

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j] as T, shuffled[i] as T];
  }
  return shuffled;
}

// ============ Game Store ============

export const useGameStore = defineStore("game", {
  state: (): GameState => createInitialState(),

  getters: {
    humanPlayer: (state): Player | undefined => {
      return state.players.find((p) => p.isHuman);
    },

    alivePlayers: (state): Player[] => {
      return state.players.filter((p) => p.alive);
    },

    aliveVillagers: (state): Player[] => {
      return state.players.filter((p) => p.alive && p.alignment === "village");
    },

    aliveWolves: (state): Player[] => {
      return state.players.filter((p) => p.alive && p.alignment === "wolf");
    },

    currentSpeaker: (state): Player | undefined => {
      if (state.currentSpeakerSeat === null) return undefined;
      return state.players.find((p) => p.seat === state.currentSpeakerSeat);
    },

    isNight: (state): boolean => {
      return state.phase === "NIGHT";
    },

    isHumanTurn: (state): boolean => {
      const human = state.players.find((p) => p.isHuman);
      if (!human) return false;
      return state.currentSpeakerSeat === human.seat;
    },

    canHumanAct(state): boolean {
      const human = state.players.find((p) => p.isHuman);
      if (!human || !human.alive) return false;

      switch (state.phase) {
        case "NIGHT":
          return this.isHumanNightAction;
        case "SPEECH":
          return state.currentSpeakerSeat === human.seat;
        case "VOTE":
          return this.isHumanVoteAction;
        case "HUNTER_SHOOT":
          return human.role === "Hunter" && state.roleAbilities.hunterCanShoot;
        default:
          return false;
      }
    },

    isHumanNightAction(): boolean {
      const human = this.humanPlayer;
      if (!human || !human.alive) return false;

      const { nightActions, roleAbilities } = this;

      // 守卫
      if (human.role === "Guard") {
        return nightActions.guardTarget === undefined;
      }
      // 狼人
      if (isWolfRole(human.role)) {
        return nightActions.wolfTarget === undefined;
      }
      // 预言家
      if (human.role === "Seer") {
        return nightActions.seerTarget === undefined;
      }
      // 女巫
      if (human.role === "Witch") {
        const canSave = !roleAbilities.witchHealUsed && nightActions.wolfTarget !== undefined;
        const canPoison = !roleAbilities.witchPoisonUsed;
        return canSave || canPoison;
      }
      return false;
    },

    isHumanVoteAction(): boolean {
      const human = this.humanPlayer;
      if (!human || !human.alive) return false;
      return this.votes[human.playerId] === undefined;
    },

    humanCanSelectPlayer(): boolean {
      const human = this.humanPlayer;
      if (!human || !human.alive) return false;

      switch (this.phase) {
        case "NIGHT":
          return this.isHumanNightAction;
        case "VOTE":
          return this.isHumanVoteAction;
        default:
          return false;
      }
    },
  },

  actions: {
    // ============ 游戏初始化 ============

    startGame(options: { playerCount: number; humanName: string }) {
      const { playerCount, humanName } = options;

      // 重置状态
      Object.assign(this, createInitialState());
      this.gameId = uuidv4();
      this.day = 1;

      // 获取角色配置
      const roles = shuffleArray([...(ROLE_CONFIG[playerCount] || ROLE_CONFIG[10] || [])]);

      // 分配人类玩家为随机角色
      const humanSeat = Math.floor(Math.random() * playerCount);

      // 创建玩家
      const aiNames = [
        "林黛玉",
        "薛宝钗",
        "贾宝玉",
        "史湘云",
        "妙玉",
        "迎春",
        "探春",
        "惜春",
        "王熙凤",
        "贾元春",
        "贾迎春",
        "贾探春",
        "贾惜春",
        "秦可卿",
        "巧姐",
        "李纨",
      ];

      this.players = roles.map((role, index) => {
        const isHuman = index === humanSeat;
        return {
          playerId: uuidv4(),
          seat: index,
          displayName: isHuman
            ? humanName || "你"
            : shuffleArray(aiNames).pop() || `玩家${index + 1}`,
          alive: true,
          role,
          alignment: getAlignment(role),
          isHuman,
        } satisfies Player;
      });

      this.phase = "NIGHT";
      this.addSystemMessage("天黑了,狼人请睁眼...");
    },

    // ============ 阶段转换 ============

    setPhase(phase: Phase) {
      this.phase = phase;
    },

    nextPhase() {
      const transitions: Record<Phase, Phase> = {
        LOBBY: "NIGHT",
        NIGHT: "DAY_START",
        DAY_START: "SPEECH",
        SPEECH: "VOTE",
        VOTE: "LAST_WORDS",
        LAST_WORDS: "HUNTER_SHOOT",
        HUNTER_SHOOT: "NIGHT",
        GAME_OVER: "LOBBY",
        REVEAL: "GAME_OVER",
      };

      const next = transitions[this.phase];
      if (next) {
        this.phase = next;
      }
    },

    // ============ 消息 ============

    addMessage(message: Omit<ChatMessage, "id" | "timestamp">) {
      this.messages.push({
        ...message,
        id: uuidv4(),
        timestamp: Date.now(),
      });
    },

    addSystemMessage(content: string) {
      this.addMessage({
        playerId: "system",
        playerName: "主持人",
        content,
        isSystem: true,
      });
    },

    addPlayerMessage(playerId: string, content: string, isLastWords = false) {
      const player = this.players.find((p) => p.playerId === playerId);
      if (!player) return;

      this.addMessage({
        playerId,
        playerName: player.displayName,
        content,
        isSystem: false,
        isLastWords,
      });
    },

    // ============ 夜晚行动 ============

    setNightAction(action: Partial<NightActions>) {
      Object.assign(this.nightActions, action);
    },

    resolveNight() {
      const deaths: Array<{ seat: number; reason: DeathReason }> = [];

      // 狼人击杀
      let wolfTarget = this.nightActions.wolfTarget;
      let guarded = false;

      // 守卫保护
      if (this.nightActions.guardTarget !== undefined) {
        if (this.nightActions.guardTarget === wolfTarget) {
          guarded = true;
        }
        this.nightActions.lastGuardTarget = this.nightActions.guardTarget;
      }

      // 女巫救人
      let saved = false;
      if (
        this.nightActions.witchSave &&
        wolfTarget !== undefined &&
        !this.roleAbilities.witchHealUsed
      ) {
        saved = true;
        this.roleAbilities.witchHealUsed = true;
      }

      // 女巫毒人
      if (this.nightActions.witchPoison !== undefined && !this.roleAbilities.witchPoisonUsed) {
        deaths.push({ seat: this.nightActions.witchPoison, reason: "poison" });
        this.roleAbilities.witchPoisonUsed = true;
      }

      // 狼人击杀结算
      if (wolfTarget !== undefined && !guarded && !saved) {
        deaths.push({ seat: wolfTarget, reason: "wolf" });
      }

      // 执行死亡
      for (const death of deaths) {
        const player = this.players.find((p) => p.seat === death.seat);
        if (player) {
          player.alive = false;
          this.deaths.push(death);

          // 猎人死亡检查
          if (player.role === "Hunter") {
            // 猎人不立即开枪,等待白天
          }
        }
      }

      // 清空夜晚行动
      this.nightActions = {};

      return deaths;
    },

    // ============ 发言阶段 ============

    startDaySpeech() {
      const alivePlayers = this.alivePlayers;
      if (alivePlayers.length === 0) return;

      // 从最小座号开始发言
      const sortedSeats = alivePlayers.map((p) => p.seat).sort((a, b) => a - b);
      this.currentSpeakerSeat = sortedSeats[0] ?? null;
    },

    nextSpeaker() {
      const alivePlayers = this.alivePlayers;
      if (alivePlayers.length === 0) return;

      const sortedSeats = alivePlayers.map((p) => p.seat).sort((a, b) => a - b);
      const currentIndex = sortedSeats.indexOf(this.currentSpeakerSeat ?? -1);

      if (currentIndex === -1 || currentIndex === sortedSeats.length - 1) {
        // 所有人发言完毕
        this.currentSpeakerSeat = null;
        this.phase = "VOTE";
      } else {
        this.currentSpeakerSeat = sortedSeats[currentIndex + 1] ?? null;
      }
    },

    // ============ 投票 ============

    castVote(voterId: string, targetSeat: number) {
      this.votes[voterId] = targetSeat;
    },

    resolveVote(): number | null {
      const alivePlayers = this.alivePlayers;
      const voteCounts: Record<number, number> = {};

      // 统计票数
      for (const [voterId, targetSeat] of Object.entries(this.votes)) {
        const voter = this.players.find((p) => p.playerId === voterId);
        if (voter && voter.alive) {
          voteCounts[targetSeat] = (voteCounts[targetSeat] || 0) + 1;
        }
      }

      // 找到最高票
      let maxVotes = 0;
      let maxSeat: number | null = null;

      for (const [seat, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count;
          maxSeat = parseInt(seat);
        }
      }

      // 检查是否平票
      const topSeats = Object.entries(voteCounts)
        .filter(([, count]) => count === maxVotes)
        .map(([seat]) => parseInt(seat));

      if (topSeats.length !== 1 || maxSeat === null) {
        return null; // 平票,无人出局
      }

      // 执行死亡
      const player = this.players.find((p) => p.seat === maxSeat);
      if (player) {
        player.alive = false;
        this.deaths.push({ seat: maxSeat, reason: "vote" });
      }

      return maxSeat;
    },

    // ============ 猎人开枪 ============

    hunterShoot(targetSeat: number | null) {
      if (targetSeat === null) return;

      const hunter = this.players.find((p) => p.role === "Hunter" && !p.alive);
      if (!hunter) return;

      const target = this.players.find((p) => p.seat === targetSeat && p.alive);
      if (!target) return;

      target.alive = false;
      this.deaths.push({ seat: targetSeat, reason: "hunter" });
      this.roleAbilities.hunterCanShoot = false;
    },

    // ============ 胜负判断 ============

    checkWinCondition(): Alignment | null {
      const wolves = this.aliveWolves;
      const villagers = this.aliveVillagers;

      if (wolves.length === 0) {
        return "village";
      }

      if (wolves.length >= villagers.length) {
        return "wolf";
      }

      return null;
    },

    // ============ 重置 ============

    reset() {
      Object.assign(this, createInitialState());
    },
  },
});
