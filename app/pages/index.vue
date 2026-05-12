<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
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
import { useGameStore } from "~/stores/game";
import { useSettingsStore } from "~/stores/settings";

const router = useRouter();
const gameStore = useGameStore();
const settingsStore = useSettingsStore();
const { startGame } = useGame();

const playerName = ref("");
const playerCount = ref(8);

function handleStartGame() {
  const name = playerName.value.trim() || "玩家";
  startGame({ playerCount: playerCount.value, humanName: name });
  router.push("/game");
}
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-linear-to-b from-slate-900 to-slate-800 p-4"
  >
    <div class="w-full max-w-md space-y-6">
      <!-- 标题 -->
      <div class="space-y-2 text-center">
        <h1 class="text-4xl font-bold text-white">狼人杀</h1>
        <p class="text-slate-400">AI 对战版</p>
      </div>

      <!-- 开始游戏卡片 -->
      <Card class="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle class="text-white">开始游戏</CardTitle>
          <CardDescription class="text-slate-400">
            填写你的信息,准备进入狼人杀的世界
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- 玩家名称 -->
          <div class="space-y-2">
            <Label for="name" class="text-slate-200">你的名字</Label>
            <Input
              id="name"
              v-model="playerName"
              placeholder="输入你的名字"
              class="border-slate-600 bg-slate-900 text-white placeholder:text-slate-500"
            />
          </div>

          <!-- 玩家数量 -->
          <div class="space-y-2">
            <Label for="count" class="text-slate-200">玩家数量</Label>
            <Select v-model="playerCount" @update:model-value="(v) => (playerCount = Number(v))">
              <SelectTrigger class="border-slate-600 bg-slate-900 text-white">
                <SelectValue placeholder="选择玩家数量" />
              </SelectTrigger>
              <SelectContent class="border-slate-700 bg-slate-800">
                <SelectItem value="6">6 人 (简单)</SelectItem>
                <SelectItem value="7">7 人</SelectItem>
                <SelectItem value="8">8 人 (标准)</SelectItem>
                <SelectItem value="9">9 人</SelectItem>
                <SelectItem value="10">10 人 (困难)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- 开始按钮 -->
          <Button class="w-full" size="lg" @click="handleStartGame"> 开始游戏 </Button>
        </CardContent>
      </Card>

      <!-- 规则说明 -->
      <Card class="border-slate-700/50 bg-slate-800/30">
        <CardContent class="p-4">
          <h3 class="mb-2 font-medium text-white">游戏规则</h3>
          <ul class="space-y-1 text-sm text-slate-400">
            <li>• 每晚狼人击杀一名玩家</li>
            <li>• 预言家可查验一名玩家身份</li>
            <li>• 女巫可用药救人或毒人</li>
            <li>• 守卫可保护一名玩家(不能连续保护同一人)</li>
            <li>• 白天发言后投票放逐嫌疑人</li>
            <li>• 狼人全部出局村民获胜,反之狼人获胜</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
