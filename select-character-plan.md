# 抽角色环节实现计划

## Context

用户希望在进入游戏之前增加一个"抽角色"环节，让玩家在正式游戏前能看到所有 AI 角色的外观、性格和身份。

**预期结果**：
`index.vue` → `select-character.vue`（抽角色）→ `game.vue`（游戏）

---

## 实施方案

### 需要创建的文件

| 文件 | 用途 |
|------|------|
| `app/stores/selectCharacter.ts` | 管理预生成角色数据 |
| `app/lib/character-utils.ts` | 洗牌、随机名字、角色配置等辅助函数 |
| `app/composables/useCharacterGenerator.ts` | 调用 LLM 生成角色性格描述 |
| `app/components/game/CharacterCard.vue` | 角色卡片展示组件 |
| `app/pages/select-character.vue` | 抽角色页面 |

### 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `app/stores/game.ts` | 新增 `startGameFromSelection()` 方法 |
| `app/pages/index.vue` | 跳转逻辑改为指向 `/select-character` |

---

## 详细实现

### 1. `app/lib/character-utils.ts` - 辅助函数

```typescript
import type { Role } from "~/types/game";
import { ROLE_CONFIG } from "~/types/game";

export function shuffleArray<T>(array: T[]): T[] { /* Fisher-Yates 洗牌 */ }
export function getRolesForCount(count: number): Role[] { /* 返回 ROLE_CONFIG[count] */ }
export function getShuffledNames(count: number): string[] { /* 随机选取红楼梦人物名 */ }
export function randomMbti(): string { /* 返回随机 MBTI */ }
export function randomMbtiDescription(): string { /* 返回预设性格描述 */ }
export function randomBackgroundStory(role: Role): string { /* 返回预设背景故事 */ }
```

### 2. `app/stores/selectCharacter.ts` - Store

```typescript
type CharacterCard = {
  playerId: string;
  seat: number;
  displayName: string;
  role: Role;
  alignment: Alignment;
  avatarSeed: string;
  mbti: string;
  mbtiDescription: string;
  backgroundStory: string;
  isHuman: boolean;
}

// State: characters[], isGenerating, generationProgress
// Actions: generateCharacters({ playerCount, humanName })
```

### 3. `app/composables/useCharacterGenerator.ts` - LLM 生成

```typescript
// 调用 /api/chat 生成 JSON：
// { mbti: string, description: string, story: string }
// 失败时降级使用 character-utils 中的随机函数
```

### 4. `app/components/game/CharacterCard.vue` - 卡片组件

- 展示 DiceBear 头像（使用 `avatarSeed = playerId`）
- 显示名字、座位号、身份标签
- 显示 MBTI、性格描述、背景故事
- 人类玩家用 `ring-primary` 高亮

### 5. `app/pages/select-character.vue` - 页面

```
┌─────────────────────────────────────┐
│ 抽卡中... / 角色一览                 │ ← 顶部栏
├─────────────────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐     │
│  │林黛玉│ │薛宝钗│ │贾宝玉│ │  ... │     │ ← 角色卡片网格
│  │预言家│ │狼人  │ │村民  │ │     │     │
│  └────┘ └────┘ └────┘ └────┘     │
├─────────────────────────────────────┤
│ 你的身份：预言家        [开始游戏]  │ ← 固定底部按钮
└─────────────────────────────────────┘
```

- 生成中显示 `Progress` 进度条
- 生成完成后显示所有角色卡片
- 点击"开始游戏"调用 `gameStore.startGameFromSelection()` 跳转到 `/game`

### 6. 修改 `app/stores/game.ts`

```typescript
startGameFromSelection(characters: CharacterCard[]) {
  // 复用现有 startGame 逻辑，但使用预生成的角色数据
  this.players = characters.map(char => ({
    playerId: char.playerId,
    seat: char.seat,
    displayName: char.displayName,
    avatarSeed: char.avatarSeed,
    role: char.role,
    alignment: char.alignment,
    isHuman: char.isHuman,
    mbti: char.mbti,
    alive: true,
  }));
  this.phase = "NIGHT";
}
```

### 7. 修改 `app/pages/index.vue`

```typescript
function handleStartGame() {
  router.push({
    path: "/select-character",
    query: { playerCount: String(playerCount.value), humanName: name }
  });
}
```

---

## 复用现有代码

- `app/types/game.ts` - `Role`, `Alignment`, `Player`, `ROLE_CONFIG`
- `app/lib/avatar-config.ts` - `buildSimpleAvatarUrl()`, `getAvatarBgColor()`
- `server/api/chat.post.ts` - LLM API 调用

---

## 验证方式

1. 启动 `pnpm dev`
2. 在首页输入昵称，选择人数，点击"开始游戏"
3. 验证跳转到 `/select-character` 页面
4. 验证：
   - 显示加载进度条
   - 所有角色卡片正确显示（头像、名字、身份）
   - 人类玩家卡片有高亮标记
   - "开始游戏"按钮可用
5. 点击"开始游戏"进入 `/game`
6. 验证游戏逻辑正常运行

---

## 实现顺序

1. `character-utils.ts` - 基础工具函数
2. `selectCharacter.ts` - Store
3. `CharacterCard.vue` - 卡片组件
4. `select-character.vue` - 页面
5. 修改 `game.ts` 和 `index.vue`
6. 测试完整流程