# Vue-Wolfcha 项目计划

## 概述

将狼人杀 AI 对战游戏从 Next.js/React/Jotai 迁移到 Vue/Nuxt/shadcn-vue/Pinia，使用更精简的游戏逻辑。

## 一、技术栈对比

| 方面     | 原项目              | 新项目                |
| -------- | ------------------- | --------------------- |
| 框架     | Next.js 16 + React  | Nuxt 4 + Vue 3        |
| 状态管理 | Jotai (atoms)       | Pinia                 |
| UI 组件  | shadcn/ui (React)   | shadcn-vue            |
| 构建工具 | webpack (--webpack) | Vite (内置)           |
| 样式     | Tailwind CSS + CSS  | Tailwind CSS (已配置) |
| 包管理   | pnpm                | pnpm                  |

## 二、目录结构

```
vue-wolfcha/
├── app/
│   ├── app.vue              # 根组件
│   ├── pages/               # Nuxt pages
│   │   ├── index.vue        # 首页/大厅
│   │   ├── game.vue         # 游戏页面
│   │   └── settings.vue      # 设置页面
│   ├── components/          # 组件
│   │   ├── ui/              # shadcn 组件 (Button, Card, Dialog...)
│   │   ├── game/            # 游戏组件
│   │   │   ├── PlayerCard.vue
│   │   │   ├── PhaseIndicator.vue
│   │   │   ├── ChatLog.vue
│   │   │   └── ActionPanel.vue
│   │   └── lobby/
│   │       └── RoleSelector.vue
│   ├── composables/         # Vue Composables (替代 hooks)
│   │   ├── useGame.ts       # 游戏主逻辑
│   │   ├── useChat.ts       # 对话管理
│   │   └── useLLM.ts        # AI 调用
│   ├── stores/              # Pinia stores
│   │   ├── game.ts          # 游戏状态
│   │   └── settings.ts       # 用户设置
│   ├── types/               # 类型定义 (type 而非 interface)
│   │   └── game.ts
│   ├── utils/               # 工具函数
│   │   ├── cn.ts            # clsx + tailwind-merge
│   │   └── game.ts          # 游戏逻辑纯函数
│   ├── lib/                 # 库代码
│   │   ├── llm.ts           # LLM 调用
│   │   └── character.ts      # 角色生成
│   └── assets/
│       └── css/
│           └── tailwind.css
├── nuxt.config.ts           # 已配置 shadcn-nuxt, @pinia/nuxt, tailwindcss
├── package.json             # 已配置依赖
└── components.json         # shadcn 组件配置
```

## 三、简化后的游戏逻辑

### 3.1 阶段简化 (Phase)

原项目 21 个阶段 → 简化至 9 个核心阶段：

```typescript
// 简化的阶段定义
type Phase =
  | "LOBBY" // 大厅
  | "NIGHT" // 夜晚（合并所有夜晚行动）
  | "DAY_START" // 白天开始
  | "SPEECH" // 发言阶段
  | "VOTE" // 投票阶段
  | "LAST_WORDS" // 遗言
  | "HUNTER_SHOOT" // 猎人开枪
  | "GAME_OVER" // 游戏结束
  | "REVEAL"; // 身份揭示
```

### 3.2 角色简化

保留核心角色，移除复杂角色：

```typescript
// 简化的角色
type Role =
  | "Villager" // 村民
  | "Werewolf" // 狼人
  | "Seer" // 预言家
  | "Witch" // 女巫
  | "Hunter" // 猎人
  | "Guard"; // 守卫
```

移除：`Idiot`, `WhiteWolfKing`, `WhiteWolf`

### 3.3 游戏流程简化

**每夜流程（简化为一个阶段）：**

1. 狼人选择目标
2. 预言家查验
3. 女巫救人/毒人
4. 守卫保护
5. 统一结算

**白天流程：**

1. 宣布夜晚死亡
2. 遗言（如有）
3. 发言（按座号顺序）
4. 投票放逐
5. 遗言（如有死亡）
6. 进入下一夜或游戏结束

### 3.4 移除了的功能

- ❌ 警徽竞选 (Badge)
- ❌ 白狼王自爆
- ❌ PK 投票
- ❌ 警长移交警徽
- ❌ 警长 1.5 票
- ❌ 警长决定发言顺序
- ❌ 详细的 localStorage 状态恢复
- ❌ 流畅的流式发言（改为段落式）
- ❌ Genshin 模式
- ❌ 观众模式
- ❌ 高级 AI 分析

## 四、类型定义 (types/game.ts)

使用 `type` 而非 `interface`，避免 `any`：

```typescript
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

// ============ 游戏对象 ============

export type Player = {
  playerId: string;
  seat: number;
  displayName: string;
  alive: boolean;
  role: Role;
  alignment: Alignment;
  isHuman: boolean;
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  content: string;
  timestamp: number;
  isSystem: boolean;
};

// ============ 游戏状态 ============

export type NightActions = {
  wolfTarget?: number;
  seerTarget?: number;
  seerResult?: { targetSeat: number; isWolf: boolean };
  witchSave?: boolean;
  witchPoison?: number;
  guardTarget?: number;
  lastGuardTarget?: number;
};

export type RoleAbilities = {
  witchHealUsed: boolean;
  witchPoisonUsed: boolean;
  hunterCanShoot: boolean;
};

export type GameState = {
  gameId: string;
  phase: Phase;
  day: number;
  players: Player[];
  messages: ChatMessage[];
  currentSpeakerSeat: number | null;
  nightActions: NightActions;
  roleAbilities: RoleAbilities;
  votes: Record<string, number>;
  deaths: Array<{ seat: number; reason: string }>;
  winner: Alignment | null;
};
```

## 五、组件清单 (使用 shadcn-vue)

需要通过 `pnpm dlx shadcn-vue@latest add` 添加的组件：

| 组件       | 用途               |
| ---------- | ------------------ |
| Button     | 主按钮、投票按钮   |
| Card       | 玩家卡片、阶段信息 |
| Dialog     | 游戏设置、角色揭示 |
| Input      | 玩家名称输入       |
| Badge      | 座位号、角色标签   |
| Avatar     | 玩家头像           |
| ScrollArea | 聊天记录滚动       |
| Select     | 设置选项           |
| Separator  | 分隔线             |
| Sheet      | 侧边菜单           |
| Toast      | 通知提示           |
| Tooltip    | 悬停提示           |
| Progress   | AI 思考进度        |

## 六、实施步骤

### 步骤 1: 环境确认

- [x] 已有 Nuxt 4 + Vue 3 项目
- [x] 已配置 shadcn-nuxt 和 tailwindcss
- [x] 已配置 @pinia/nuxt
- [x] 添加 shadcn-vue 组件

### 步骤 2: 添加 shadcn-vue 组件

- [x] button, card, dialog, input, badge, avatar, scroll-area, select, separator, sheet, sonner, progress, tooltip, label

### 步骤 3: 创建类型定义

- [x] `app/types/game.ts` - 简化后的类型定义

### 步骤 4: 创建 Pinia Store

- [x] `app/stores/game.ts` - 游戏状态管理
- [x] `app/stores/settings.ts` - 用户设置

### 步骤 5: 创建游戏逻辑纯函数

- [x] `app/composables/useGame.ts` - 游戏主逻辑 composable

### 步骤 6: 创建 Composables

- [x] `app/composables/useGame.ts` - 游戏主逻辑

### 步骤 7: 创建页面

- [x] `app/pages/index.vue` - 大厅页面
- [x] `app/pages/game.vue` - 游戏页面
- [x] `app/pages/settings.vue` - 设置页面

### 步骤 8: 创建游戏组件

- [x] `app/components/game/PlayerCard.vue`
- [x] `app/components/game/PhaseIndicator.vue`
- [x] `app/components/game/ChatLog.vue`
- [x] `app/components/game/ActionPanel.vue`

### 步骤 9: 集成 API 路由

- [x] `server/api/chat.post.ts` - LLM 代理
- [ ] `server/api/tts.post.ts` - TTS (如需要)

### 步骤 10: 创建 LLM Composable

- [x] `app/composables/useLLM.ts` - AI 调用封装

## 七、编码规范

1. **类型定义**：全部使用 `type`，禁止 `interface`（除非是第三方库要求）
2. **禁止 any**：仅在处理 error 时使用 `unknown` 或 `any`
3. **组件引入**：通过 shadcn-vue 自动引入
4. **样式**：使用 Tailwind CSS 类，不自己写 CSS
5. **状态管理**：Pinia store 管理状态
6. **Composables**：Vue 组合式函数替代 React hooks

## 八、优先级

1. **P0 - 核心功能**
   - 游戏类型定义
   - Pinia Store
   - 大厅页面 + 开始游戏
   - 游戏页面基础布局
   - 夜晚行动流程
   - 白天发言流程
   - 投票流程
   - 游戏结束

2. **P1 - 重要功能**
   - AI 对话生成
   - 角色揭示
   - 聊天记录

3. **P2 - 增强功能**
   - 设置页面
   - 音效（TTS）
   - 游戏存档
