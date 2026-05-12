<script setup lang="ts">
import { Skull, Moon, Sun, Shield } from "lucide-vue-next";
import { ref, computed } from "vue";
import { useRouter } from "vue-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useGame } from "~/composables/useGame";

const router = useRouter();
const { startGame } = useGame();

const humanName = ref("");
const playerCount = ref(8);
const difficulty = ref("normal");

const rolePreview = computed(() => {
  const configs: Record<number, { wolves: number; roles: string[] }> = {
    6: { wolves: 1, roles: ["狼人", "预言家", "女巫", "村民", "村民", "村民"] },
    7: { wolves: 2, roles: ["狼人", "狼人", "预言家", "女巫", "村民", "村民", "村民"] },
    8: { wolves: 2, roles: ["狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "村民", "村民"] },
    9: {
      wolves: 2,
      roles: ["狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "村民", "村民", "村民"],
    },
    10: {
      wolves: 3,
      roles: ["狼人", "狼人", "狼人", "预言家", "女巫", "猎人", "守卫", "村民", "村民", "村民"],
    },
  };
  return configs[playerCount.value] || configs[8];
});

function handleStartGame() {
  const name = humanName.value.trim() || "玩家";
  startGame({ playerCount: playerCount.value, humanName: name });
  router.push("/game");
}
</script>

<template>
  <div class="bg-background min-h-screen">
    <!-- 背景装饰 -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden">
      <div class="bg-primary/5 absolute top-1/4 left-1/4 h-125 w-125 rounded-full blur-[120px]" />
      <div
        class="bg-primary/5 absolute right-1/4 bottom-1/4 h-125 w-125 rounded-full blur-[120px]"
      />
    </div>

    <div class="relative z-10 flex min-h-screen flex-col items-center justify-center p-4">
      <!-- Logo 区域 -->
      <div class="mb-10 text-center">
        <div class="mb-4 flex items-center justify-center gap-4">
          <Moon class="text-primary h-14 w-14 animate-pulse" />
          <h1 class="text-foreground text-6xl font-bold tracking-tight drop-shadow-lg">狼人杀</h1>
          <Skull class="text-destructive h-14 w-14" />
        </div>
        <p class="text-muted-foreground text-lg">AI 对战版 · 与智能 AI 玩家同台竞技</p>
      </div>

      <!-- 主卡片 -->
      <Card class="border-border bg-card w-full max-w-md shadow-2xl">
        <CardHeader class="pb-2 text-center">
          <CardTitle class="text-foreground text-2xl">创建游戏</CardTitle>
        </CardHeader>

        <CardContent class="space-y-5">
          <!-- 昵称输入 -->
          <div class="space-y-2">
            <Label for="name" class="text-foreground">你的昵称</Label>
            <Input
              id="name"
              v-model="humanName"
              placeholder="输入昵称"
              class="text-foreground placeholder:text-muted-foreground h-12 text-lg"
            />
          </div>

          <!-- 玩家数量 -->
          <div class="space-y-2">
            <Label class="text-foreground">玩家数量</Label>
            <Select v-model="playerCount" @update:model-value="(v) => (playerCount = Number(v))">
              <SelectTrigger class="text-foreground h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent class="bg-card border-border">
                <SelectItem :value="6">6 人 · 简单</SelectItem>
                <SelectItem :value="7">7 人</SelectItem>
                <SelectItem :value="8">8 人 · 标准</SelectItem>
                <SelectItem :value="9">9 人</SelectItem>
                <SelectItem :value="10">10 人 · 困难</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- 难度选择 -->
          <div class="space-y-2">
            <Label class="text-foreground">游戏难度</Label>
            <Select v-model="difficulty" @update:model-value="(v) => (difficulty = v as string)">
              <SelectTrigger class="text-foreground h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent class="bg-card border-border">
                <SelectItem value="easy">简单 · AI 表现较差</SelectItem>
                <SelectItem value="normal">普通 · AI 正常表现</SelectItem>
                <SelectItem value="hard">困难 · AI 表现更强</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- 角色预览 -->
          <div class="border-border bg-muted/30 rounded-lg border p-4">
            <div class="mb-3 flex items-center justify-between">
              <span class="text-muted-foreground text-sm">角色配置</span>
              <Badge variant="destructive"> {{ rolePreview!.wolves }} 狼人 </Badge>
            </div>
            <div class="flex flex-wrap gap-2">
              <Badge
                v-for="(role, index) in rolePreview!.roles"
                :key="index"
                :variant="role === '狼人' ? 'destructive' : 'secondary'"
                class="px-2.5 py-1 text-xs"
              >
                {{ role }}
              </Badge>
            </div>
          </div>

          <!-- 开始按钮 -->
          <Button class="h-14 w-full text-lg font-semibold" size="lg" @click="handleStartGame">
            <Skull class="mr-2 h-5 w-5" />
            开始游戏
          </Button>
        </CardContent>
      </Card>

      <!-- 游戏规则卡片 -->
      <Card class="border-border bg-card/40 mt-6 w-full max-w-md">
        <CardContent class="p-5">
          <div class="grid grid-cols-2 gap-6">
            <div class="bg-muted/30 flex flex-col items-center gap-2 rounded-lg p-4">
              <Moon class="text-primary h-8 w-8" />
              <span class="text-foreground text-sm font-medium">夜晚行动</span>
              <div class="text-muted-foreground space-y-0.5 text-center text-xs">
                <p>狼人击杀 · 预言查验</p>
                <p>女巫用药 · 守卫保护</p>
              </div>
            </div>
            <div class="bg-muted/30 flex flex-col items-center gap-2 rounded-lg p-4">
              <Sun class="text-primary h-8 w-8" />
              <span class="text-foreground text-sm font-medium">白天流程</span>
              <div class="text-muted-foreground space-y-0.5 text-center text-xs">
                <p>发言讨论 · 投票放逐</p>
                <p>遗言环节 · 胜负判定</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 底部信息 -->
      <div class="text-muted-foreground mt-8 flex items-center gap-2 text-xs">
        <Shield class="h-3 w-3" />
        <span>点击开始即表示同意游戏规则</span>
      </div>
    </div>
  </div>
</template>
