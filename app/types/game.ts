// ============ 基础类型 ============

export type Role = "Villager" | "Werewolf" | "Seer" | "Witch" | "Hunter" | "Guard";

export type Alignment = "village" | "wolf";

export type Phase =
  | "LOBBY"
  | "NIGHT"
  | "DAY_START"
  | "SPEECH"
  | "VOTE"
  | "LAST_WORDS"
  | "HUNTER_SHOOT"
  | "GAME_OVER"
  | "REVEAL";

export type DifficultyLevel = "easy" | "normal" | "hard";

export type GameEventType =
  | "GAME_START"
  | "PHASE_CHANGED"
  | "PLAYER_DIED"
  | "VOTE_CAST"
  | "GAME_END";

export type DeathReason = "wolf" | "poison" | "vote" | "hunter";

// ============ 玩家 ============

export type Player = {
  playerId: string;
  seat: number;
  displayName: string;
  avatarSeed?: string;
  alive: boolean;
  role: Role;
  alignment: Alignment;
  isHuman: boolean;
  modelId?: string;
  mbti?: string;
};

// ============ 消息 ============

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  content: string;
  timestamp: number;
  isSystem: boolean;
  isLastWords?: boolean;
};

// ============ 游戏事件 ============

export type GameEvent = {
  id: string;
  ts: number;
  type: GameEventType;
  payload: unknown;
};

// ============ 夜间行动 ============

export type NightActions = {
  wolfTarget?: number;
  seerTarget?: number;
  seerResult?: { targetSeat: number; isWolf: boolean };
  witchSave?: boolean;
  witchPoison?: number;
  guardTarget?: number;
  lastGuardTarget?: number;
};

// ============ 角色能力 ============

export type RoleAbilities = {
  witchHealUsed: boolean;
  witchPoisonUsed: boolean;
  hunterCanShoot: boolean;
};

// ============ 游戏状态 ============

export type GameState = {
  gameId: string;
  phase: Phase;
  day: number;
  players: Player[];
  messages: ChatMessage[];
  events: GameEvent[];
  currentSpeakerSeat: number | null;
  nightActions: NightActions;
  roleAbilities: RoleAbilities;
  votes: Record<string, number>;
  voteReasons: Record<string, string>;
  voteHistory: Record<number, Record<string, number>>;
  deaths: Array<{ seat: number; reason: DeathReason }>;
  winner: Alignment | null;
  seerResults: Array<{ targetSeat: number; isWolf: boolean }>;
};

// ============ 游戏配置 ============

export type RoleConfig = Record<number, Role[]>;

export const ROLE_CONFIG: RoleConfig = {
  6: ["Werewolf", "Seer", "Witch", "Villager", "Villager", "Villager"],
  7: ["Werewolf", "Werewolf", "Seer", "Witch", "Villager", "Villager", "Villager"],
  8: ["Werewolf", "Werewolf", "Seer", "Witch", "Hunter", "Guard", "Villager", "Villager"],
  9: [
    "Werewolf",
    "Werewolf",
    "Seer",
    "Witch",
    "Hunter",
    "Guard",
    "Villager",
    "Villager",
    "Villager",
  ],
  10: [
    "Werewolf",
    "Werewolf",
    "Werewolf",
    "Seer",
    "Witch",
    "Hunter",
    "Guard",
    "Villager",
    "Villager",
    "Villager",
  ],
};

// ============ 辅助函数 ============

export function isWolfRole(role: Role): boolean {
  return role === "Werewolf";
}

export function getAlignment(role: Role): Alignment {
  return isWolfRole(role) ? "wolf" : "village";
}

export function getRoleDisplayName(role: Role): string {
  const names: Record<Role, string> = {
    Villager: "村民",
    Werewolf: "狼人",
    Seer: "预言家",
    Witch: "女巫",
    Hunter: "猎人",
    Guard: "守卫",
  };
  return names[role];
}
