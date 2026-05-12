# CLAUDE.md

Wolfcha 是一个 AI 狼人杀对战游戏，使用 Vue 3 + Nuxt 4 + shadcn-vue + Pinia 构建。

## 技术栈

| 方面 | 技术 |
|------|------|
| 框架 | Nuxt 4 + Vue 3 |
| UI 组件 | shadcn-vue (通过 `pnpm dlx shadcn-vue@latest add` 添加) |
| 样式 | Tailwind CSS (使用 CSS 变量) |
| 状态管理 | Pinia |
| 包管理 | pnpm |

## 开发命令

```bash
pnpm dev          # 启动开发服务器 (localhost:3000)
pnpm build        # 生产构建
pnpm start        # 启动生产服务器
pnpm typecheck    # TypeScript 类型检查
```

## 颜色规范

**重要：所有颜色必须使用 app/assets/css/tailwind.css 中定义的 CSS 变量，禁止自创颜色。**


## 类型定义规范

1. **全部使用 `type`**，禁止使用 `interface`
2. **禁止使用 `any`**，仅在捕获 error 时使用 `unknown` 或 `any`
3. 从 `~/types/game` 导入类型时使用具名导入：`import type { Role, Phase } from '~/types/game'`

```typescript
// 正确
type Player = {
  id: string;
  name: string;
};

// 错误
interface Player {
  id: string;
  name: string;
}

// 错误 - 不能用 any
function handleError(err: any) { }

// 正确 - 用 unknown
function handleError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
}
```

## 组件使用规范

1. **优先使用 shadcn-vue 组件**，通过 `pnpm dlx shadcn-vue@latest add <component>` 添加
2. **禁止手写 CSS 样式**，使用 Tailwind 工具类
3. 组件通过 Nuxt 的自动导入使用，无需手动 import

可用组件：Button, Card, Dialog, Input, Badge, Avatar, ScrollArea, Select, Separator, Sheet, Sonner, Progress, Tooltip, Label, Switch

## 文件结构

```
app/
├── pages/              # 页面
│   ├── index.vue       # 大厅/首页
│   ├── game.vue        # 游戏页面
│   └── settings.vue    # 设置页面
├── components/
│   ├── ui/             # shadcn 组件 (自动生成)
│   └── game/           # 游戏业务组件
├── composables/        # Vue Composables
│   ├── useGame.ts      # 游戏主逻辑
│   └── useLLM.ts       # AI 调用
├── stores/             # Pinia Stores
│   ├── game.ts         # 游戏状态
│   └── settings.ts     # 用户设置
├── types/
│   └── game.ts         # 游戏类型定义
└── assets/
    └── css/
        └── tailwind.css  # Tailwind 配置 (包含 CSS 变量)
server/
└── api/                # API 路由
    └── chat.post.ts    # LLM 代理
```

## 游戏状态

游戏状态通过 Pinia store 管理 (`app/stores/game.ts`)：
- `phase` - 当前游戏阶段
- `players` - 所有玩家
- `messages` - 聊天记录
- `nightActions` - 夜晚行动
- `votes` - 投票记录

## API 设计

所有 AI 调用通过 `/api/chat` 代理,使用 `DeepSeek v4 Flash` 模型

```typescript

## 注意事项

1. 页面切换使用 Vue Router (`useRouter`)
2. Store 通过 `useGameStore()` 访问
3. 类型检查：`pnpm nuxt typecheck`