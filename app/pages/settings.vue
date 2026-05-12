<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
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
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { useSettingsStore } from "~/stores/settings";

const router = useRouter();
const settingsStore = useSettingsStore();

function handleSave() {
  router.push("/");
}
</script>

<template>
  <div class="min-h-screen bg-linear-to-b from-slate-900 to-slate-800 p-4">
    <div class="mx-auto max-w-md space-y-6">
      <!-- 返回按钮 -->
      <Button variant="ghost" class="text-slate-400" @click="router.back()">
        <ArrowLeft class="mr-2 h-4 w-4" />
        返回
      </Button>

      <!-- 设置标题 -->
      <div class="text-center">
        <h1 class="text-2xl font-bold text-white">设置</h1>
        <p class="text-sm text-slate-400">自定义你的游戏体验</p>
      </div>

      <!-- 基本设置 -->
      <Card class="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle class="text-lg text-white">基本设置</CardTitle>
          <CardDescription class="text-slate-400">游戏基础配置</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- 玩家名称 -->
          <div class="space-y-2">
            <Label for="playerName" class="text-slate-200">默认昵称</Label>
            <Input
              id="playerName"
              v-model="settingsStore.playerName"
              placeholder="输入你的昵称"
              class="border-slate-600 bg-slate-900 text-white placeholder:text-slate-500"
            />
          </div>

          <!-- 玩家数量 -->
          <div class="space-y-2">
            <Label for="playerCount" class="text-slate-200">默认玩家数量</Label>
            <Select
              :model-value="String(settingsStore.playerCount)"
              @update:model-value="(v) => settingsStore.setPlayerCount(Number(v))"
            >
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
        </CardContent>
      </Card>

      <!-- 游戏设置 -->
      <Card class="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle class="text-lg text-white">游戏设置</CardTitle>
          <CardDescription class="text-slate-400">游戏玩法配置</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- 难度 -->
          <div class="space-y-2">
            <Label for="difficulty" class="text-slate-200">AI 难度</Label>
            <Select
              :model-value="settingsStore.difficulty"
              @update:model-value="(v) => settingsStore.setDifficulty(v as any)"
            >
              <SelectTrigger class="border-slate-600 bg-slate-900 text-white">
                <SelectValue placeholder="选择难度" />
              </SelectTrigger>
              <SelectContent class="border-slate-700 bg-slate-800">
                <SelectItem value="easy">简单 - AI 表现较差</SelectItem>
                <SelectItem value="normal">普通 - AI 正常表现</SelectItem>
                <SelectItem value="hard">困难 - AI 表现更强</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator class="bg-slate-700" />

          <!-- 自动播放 -->
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label class="text-slate-200">自动播放</Label>
              <p class="text-sm text-slate-400">AI 发言后自动继续游戏</p>
            </div>
            <Switch
              :checked="settingsStore.autoPlay"
              @update:checked="settingsStore.toggleAutoPlay()"
            />
          </div>
        </CardContent>
      </Card>

      <!-- 保存按钮 -->
      <Button class="w-full" size="lg" @click="handleSave"> 保存设置 </Button>

      <!-- 版本信息 -->
      <div class="text-center text-sm text-slate-500">Vue-Wolfcha v1.0.0</div>
    </div>
  </div>
</template>
