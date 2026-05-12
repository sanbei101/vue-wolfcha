<script setup lang="ts">
import { Skull, Moon, Sun, Users, Shield } from "lucide-vue-next";
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
  <div class="min-h-screen bg-linear-to-b from-slate-950 via-slate-900 to-slate-950">
    <!-- 背景装饰 -->
    <div class="pointer-events-none fixed inset-0 overflow-hidden">
      <div class="absolute top-1/4 left-1/4 h-125 w-125 rounded-full bg-red-600/10 blur-[120px]" />
      <div
        class="absolute right-1/4 bottom-1/4 h-125 w-125 rounded-full bg-blue-600/10 blur-[120px]"
      />
    </div>

    <div class="relative z-10 flex min-h-screen flex-col items-center justify-center p-4">
      <!-- Logo 区域 -->
      <div class="mb-10 text-center">
        <div class="mb-4 flex items-center justify-center gap-4">
          <Moon class="h-14 w-14 animate-pulse text-yellow-500" />
          <h1 class="text-6xl font-bold tracking-tight text-white drop-shadow-lg">狼人杀</h1>
          <Skull class="h-14 w-14 text-red-500" />
        </div>
        <p class="text-lg text-slate-400">AI 对战版 · 与智能 AI 玩家同台竞技</p>
      </div>

      <!-- 主卡片 -->
      <Card
        class="w-full max-w-md border-slate-700/50 bg-slate-900/80 shadow-2xl shadow-black/50 backdrop-blur-xl"
      >
        <CardHeader class="pb-2 text-center">
          <CardTitle class="text-2xl text-white">创建游戏</CardTitle>
        </CardHeader>

        <CardContent class="space-y-5">
          <!-- 昵称输入 -->
          <div class="space-y-2">
            <Label for="name" class="text-slate-300">你的昵称</Label>
            <Input
              id="name"
              v-model="humanName"
              placeholder="输入昵称"
              class="h-12 border-slate-600 bg-slate-800/80 text-lg text-white placeholder:text-slate-500 focus:border-yellow-500 focus:ring-yellow-500/20"
            />
          </div>

          <!-- 玩家数量 -->
          <div class="space-y-2">
            <Label class="text-slate-300">玩家数量</Label>
            <Select v-model="playerCount" @update:model-value="(v) => (playerCount = Number(v))">
              <SelectTrigger
                class="h-12 border-slate-600 bg-slate-800/80 text-white focus:border-yellow-500"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent class="border-slate-700 bg-slate-800">
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
            <Label class="text-slate-300">游戏难度</Label>
            <Select v-model="difficulty" @update:model-value="(v) => (difficulty = v as string)">
              <SelectTrigger
                class="h-12 border-slate-600 bg-slate-800/80 text-white focus:border-yellow-500"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent class="border-slate-700 bg-slate-800">
                <SelectItem value="easy">简单 · AI 表现较差</SelectItem>
                <SelectItem value="normal">普通 · AI 正常表现</SelectItem>
                <SelectItem value="hard">困难 · AI 表现更强</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- 角色预览 -->
          <div class="rounded-lg border border-slate-700/50 bg-slate-800/50 p-4">
            <div class="mb-3 flex items-center justify-between">
              <span class="text-sm text-slate-400">角色配置</span>
              <Badge class="border-red-500/30 bg-red-500/20 text-red-400">
                {{ rolePreview!.wolves }} 狼人
              </Badge>
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
          <Button
            class="h-14 w-full bg-linear-to-r from-red-600 to-red-700 text-lg font-semibold text-white shadow-lg shadow-red-900/30 hover:from-red-500 hover:to-red-600"
            size="lg"
            @click="handleStartGame"
          >
            <Skull class="mr-2 h-5 w-5" />
            开始游戏
          </Button>
        </CardContent>
      </Card>

      <!-- 游戏规则卡片 -->
      <Card class="mt-6 w-full max-w-md border-slate-700/30 bg-slate-900/40 backdrop-blur">
        <CardContent class="p-5">
          <div class="grid grid-cols-2 gap-6">
            <div class="flex flex-col items-center gap-2 rounded-lg bg-slate-800/30 p-4">
              <Moon class="h-8 w-8 text-yellow-500" />
              <span class="text-sm font-medium text-slate-200">夜晚行动</span>
              <div class="space-y-0.5 text-center text-xs text-slate-500">
                <p>狼人击杀 · 预言查验</p>
                <p>女巫用药 · 守卫保护</p>
              </div>
            </div>
            <div class="flex flex-col items-center gap-2 rounded-lg bg-slate-800/30 p-4">
              <Sun class="h-8 w-8 text-orange-500" />
              <span class="text-sm font-medium text-slate-200">白天流程</span>
              <div class="space-y-0.5 text-center text-xs text-slate-500">
                <p>发言讨论 · 投票放逐</p>
                <p>遗言环节 · 胜负判定</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 底部信息 -->
      <div class="mt-8 flex items-center gap-2 text-xs text-slate-600">
        <Shield class="h-3 w-3" />
        <span>点击开始即表示同意游戏规则</span>
      </div>
    </div>
  </div>
</template>
