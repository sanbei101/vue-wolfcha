<script setup lang="ts">
import {
  Moon,
  Sun,
  Users,
  Vote,
  Skull,
  Shield,
  ChevronLeft,
  Play,
  SkipForward,
} from "lucide-vue-next";
import { computed, onMounted, ref, watch, nextTick } from "vue";
import { useRouter } from "vue-router";

import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { useGame } from "~/composables/useGame";
import { useGameStore } from "~/stores/game";
import { getRoleDisplayName } from "~/types/game";
import type { Player } from "~/types/game";

const router = useRouter();
const gameStore = useGameStore();
const { executeNightActions, executeDaySpeech, executeVote, checkAndEndGame } = useGame();

const isProcessing = ref(false);
const humanInput = ref("");
const showRole = ref(false);
const chatScrollRef = ref<HTMLElement | null>(null);

// 跳转到大厅如果没在游戏中
onMounted(() => {
  if (gameStore.phase === "LOBBY") {
    router.push("/");
  }
});

// 自动滚动聊天
watch(
  () => gameStore.messages.length,
  async () => {
    await nextTick();
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight;
    }
  },
);

// ============ 计算属性 ============

const isNight = computed(() => gameStore.phase === "NIGHT");

const phaseInfo = computed(() => {
  const phaseLabels: Record<string, { label: string; desc: string; icon: typeof Moon }> = {
    NIGHT: { label: "夜晚", desc: "狼人请睁眼...", icon: Moon },
    DAY_START: { label: "白天", desc: "天亮了，请等待...", icon: Sun },
    SPEECH: { label: "发言", desc: "请按顺序发言", icon: Users },
    VOTE: { label: "投票", desc: "请投票放逐嫌疑人", icon: Vote },
    LAST_WORDS: { label: "遗言", desc: "临终遗言", icon: Skull },
    HUNTER_SHOOT: { label: "猎人", desc: "猎人请选择目标", icon: Skull },
    GAME_OVER: { label: "游戏结束", desc: "", icon: Skull },
  };
  return phaseLabels[gameStore.phase] || { label: "", desc: "", icon: Moon };
});

const currentPhaseIcon = computed(() => phaseInfo.value.icon);

const humanPlayer = computed(() => gameStore.humanPlayer);

// 人类是否可以操作
const canHumanAct = computed(() => {
  if (!humanPlayer.value || !humanPlayer.value.alive) return false;

  if (gameStore.phase === "NIGHT") {
    // 检查人类是否需要执行夜晚行动
    const role = humanPlayer.value.role;
    switch (role) {
      case "Werewolf":
        return gameStore.nightActions.wolfTarget === undefined;
      case "Seer":
        return gameStore.nightActions.seerTarget === undefined;
      case "Guard":
        return gameStore.nightActions.guardTarget === undefined;
      case "Witch":
        const canSave =
          !gameStore.roleAbilities.witchHealUsed && gameStore.nightActions.wolfTarget !== undefined;
        const canPoison = !gameStore.roleAbilities.witchPoisonUsed;
        return canSave || canPoison;
      default:
        return false;
    }
  }

  if (gameStore.phase === "SPEECH") {
    return gameStore.currentSpeakerSeat === humanPlayer.value.seat;
  }

  if (gameStore.phase === "VOTE") {
    return gameStore.votes[humanPlayer.value.playerId] === undefined;
  }

  if (gameStore.phase === "HUNTER_SHOOT" && humanPlayer.value.role === "Hunter") {
    return gameStore.roleAbilities.hunterCanShoot;
  }

  return false;
});

// 人类是否可以点击玩家
const canClickPlayer = computed(() => {
  if (!canHumanAct.value) return false;

  if (gameStore.phase === "NIGHT") {
    const role = humanPlayer.value?.role;
    return role === "Werewolf" || role === "Seer" || role === "Guard" || role === "Witch";
  }

  if (gameStore.phase === "VOTE") {
    return true;
  }

  return false;
});

// ============ 玩家选择 ============

function handlePlayerClick(seat: number) {
  if (!canClickPlayer.value) return;
  if (!humanPlayer.value?.alive) return;

  const targetPlayer = gameStore.players.find((p) => p.seat === seat);
  if (!targetPlayer || !targetPlayer.alive) return;

  switch (gameStore.phase) {
    case "NIGHT":
      handleNightAction(seat);
      break;
    case "VOTE":
      handleVote(seat);
      break;
  }
}

function handleNightAction(seat: number) {
  const role = humanPlayer.value?.role;
  switch (role) {
    case "Werewolf":
      gameStore.setNightAction({ wolfTarget: seat });
      break;
    case "Seer":
      gameStore.setNightAction({ seerTarget: seat });
      const target = gameStore.players.find((p) => p.seat === seat);
      if (target) {
        gameStore.setNightAction({
          seerResult: { targetSeat: seat, isWolf: target.role === "Werewolf" },
        });
      }
      break;
    case "Guard":
      // 守卫不能连续保护同一人
      if (gameStore.nightActions.lastGuardTarget === seat) {
        return; // 不能选择
      }
      gameStore.setNightAction({ guardTarget: seat });
      break;
  }
}

function handleVote(seat: number) {
  if (!humanPlayer.value) return;
  gameStore.castVote(humanPlayer.value.playerId, seat);
}

// ============ 女巫行动 ============

function witchSave() {
  gameStore.setNightAction({ witchSave: true });
}

function witchPoison() {
  // 女巫毒人需要选择目标
}

function witchPass() {
  gameStore.setNightAction({ witchSave: false });
}

// ============ 猎人开枪 ============

function hunterShoot(seat: number) {
  gameStore.hunterShoot(seat);
}

function hunterPass() {
  gameStore.hunterShoot(null);
  gameStore.nextPhase();
}

// ============ 发言 ============

function submitSpeech() {
  if (!humanPlayer.value || !humanInput.value.trim()) return;
  gameStore.addPlayerMessage(humanPlayer.value.playerId, humanInput.value.trim());
  humanInput.value = "";
  gameStore.nextSpeaker();
}

// ============ 游戏流程 ============

async function continueGame() {
  if (isProcessing.value) return;
  isProcessing.value = true;

  try {
    // 检查胜负
    const winner = checkAndEndGame();
    if (winner) {
      return;
    }

    switch (gameStore.phase) {
      case "NIGHT":
        // 如果人类还没完成夜晚行动，等待
        if (
          canHumanAct.value &&
          humanPlayer.value?.role !== "Villager" &&
          humanPlayer.value?.role !== "Hunter"
        ) {
          return;
        }
        // 执行夜晚行动
        await executeNightActions();
        gameStore.setPhase("DAY_START");
        break;

      case "DAY_START":
        // 结算夜晚死亡
        if (gameStore.deaths.length > 0) {
          const deaths = gameStore.deaths;
          const names = deaths
            .map((d) => gameStore.players.find((p) => p.seat === d.seat)?.displayName)
            .filter(Boolean)
            .join("、");
          gameStore.addSystemMessage(`昨夜死亡: ${names}`);
        } else {
          gameStore.addSystemMessage("昨夜是平安夜");
        }
        // 清空死亡记录，开始新的一天
        gameStore.deaths = [];
        gameStore.setPhase("SPEECH");
        gameStore.startDaySpeech();
        break;

      case "SPEECH":
        // 等待所有玩家发言完毕
        if (gameStore.currentSpeakerSeat !== null) {
          return; // 还有人在发言
        }
        // 发言完毕，进入投票
        gameStore.setPhase("VOTE");
        break;

      case "VOTE":
        // 投票已由玩家完成，检查是否需要结算
        const voteResult = gameStore.resolveVote();
        if (voteResult === null) {
          gameStore.addSystemMessage("投票平票，无人出局");
          // 重新发言
          gameStore.setPhase("SPEECH");
          gameStore.startDaySpeech();
        } else {
          const player = gameStore.players.find((p) => p.seat === voteResult);
          gameStore.addSystemMessage(`${player?.displayName || "未知"}被投票出局`);
          player && (player.alive = false);

          // 检查猎人
          if (player?.role === "Hunter") {
            gameStore.setPhase("HUNTER_SHOOT");
          } else {
            // 进入下一夜
            gameStore.day++;
            gameStore.setPhase("NIGHT");
          }
        }
        break;

      case "HUNTER_SHOOT":
        // 猎人阶段跳过，等待人类操作
        if (humanPlayer.value?.role === "Hunter" && gameStore.roleAbilities.hunterCanShoot) {
          return;
        }
        // AI 猎人随机开枪
        const alivePlayers = gameStore.alivePlayers;
        if (alivePlayers.length > 0 && humanPlayer.value?.role !== "Hunter") {
          const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
          gameStore.hunterShoot(target!.seat);
        }
        gameStore.nextPhase();
        break;
    }
  } finally {
    isProcessing.value = false;
  }
}

// ============ 辅助函数 ============

function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    Werewolf: "bg-red-500",
    Seer: "bg-yellow-500",
    Witch: "bg-purple-500",
    Guard: "bg-blue-500",
    Hunter: "bg-orange-500",
    Villager: "bg-green-500",
  };
  return colors[role] || "bg-gray-500";
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function returnToLobby() {
  gameStore.reset();
  router.push("/");
}
</script>

<template>
  <div
    class="min-h-screen text-white transition-colors duration-1000"
    :class="isNight ? 'bg-slate-950' : 'bg-linear-to-b from-slate-800 to-slate-900'"
  >
    <!-- 顶部导航栏 -->
    <header
      class="sticky top-0 z-50 border-b px-4 py-3 backdrop-blur-md"
      :class="isNight ? 'border-slate-800 bg-slate-950/90' : 'border-slate-700 bg-slate-900/90'"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between">
        <div class="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            @click="returnToLobby"
            class="text-slate-400 hover:text-white"
          >
            <ChevronLeft class="h-5 w-5" />
          </Button>
          <component
            :is="currentPhaseIcon"
            class="h-6 w-6 transition-colors"
            :class="isNight ? 'text-yellow-500' : 'text-orange-500'"
          />
          <span class="text-lg font-semibold">{{ phaseInfo.label }}</span>
          <Badge v-if="gameStore.phase !== 'LOBBY'" variant="secondary" class="text-xs">
            第 {{ gameStore.day }} 天
          </Badge>
        </div>

        <div class="flex items-center gap-2">
          <Button
            v-if="gameStore.phase === 'GAME_OVER'"
            variant="outline"
            size="sm"
            @click="returnToLobby"
          >
            返回大厅
          </Button>
          <Button v-else variant="outline" size="sm" @click="showRole = true">
            {{ humanPlayer?.role ? getRoleDisplayName(humanPlayer.role) : "我的身份" }}
          </Button>
        </div>
      </div>
    </header>

    <!-- 阶段提示 -->
    <div
      class="border-b px-4 py-2 text-center text-sm transition-colors duration-1000"
      :class="
        isNight
          ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400'
          : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
      "
    >
      {{ phaseInfo.desc }}
    </div>

    <!-- 人类行动提示 -->
    <div
      v-if="canHumanAct"
      class="animate-pulse border-b border-blue-500/30 bg-blue-500/10 px-4 py-3 text-center"
    >
      <span class="font-medium text-blue-300">轮到你行动了！</span>
    </div>

    <!-- 主内容 -->
    <main class="mx-auto max-w-6xl p-4">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- 左侧：玩家列表 -->
        <div class="lg:col-span-1">
          <Card class="border-slate-700 bg-slate-900/50 backdrop-blur">
            <CardHeader class="pb-2">
              <CardTitle class="text-sm text-slate-400">
                玩家 ({{ gameStore.players.length }})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="player in gameStore.players"
                  :key="player.playerId"
                  class="relative flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-all"
                  :class="[
                    !player.alive && 'opacity-50 grayscale',
                    canClickPlayer && player.alive && 'cursor-pointer hover:bg-slate-700',
                    gameStore.currentSpeakerSeat === player.seat &&
                      'bg-yellow-500/10 ring-2 ring-yellow-500',
                    gameStore.nightActions.seerResult?.targetSeat === player.seat &&
                      'ring-2 ring-blue-500',
                  ]"
                  @click="handlePlayerClick(player.seat)"
                >
                  <Avatar class="h-10 w-10">
                    <AvatarFallback :class="getRoleColor(player.role)">
                      {{ player.seat + 1 }}
                    </AvatarFallback>
                  </Avatar>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1">
                      <span
                        class="truncate text-sm font-medium"
                        :class="player.isHuman && 'text-yellow-400'"
                      >
                        {{ player.displayName }}
                      </span>
                      <Badge v-if="player.isHuman" variant="outline" class="px-1 py-0 text-[10px]">
                        你
                      </Badge>
                    </div>
                    <div class="flex items-center gap-1 text-xs text-slate-500">
                      <span>座位 {{ player.seat + 1 }}</span>
                      <span v-if="!player.alive" class="text-red-400">死亡</span>
                    </div>
                  </div>

                  <!-- 预言家查验结果 -->
                  <div
                    v-if="gameStore.nightActions.seerResult?.targetSeat === player.seat"
                    class="absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    :class="
                      gameStore.nightActions.seerResult.isWolf
                        ? 'bg-red-500 text-white'
                        : 'bg-green-500 text-white'
                    "
                  >
                    {{ gameStore.nightActions.seerResult.isWolf ? "狼" : "好" }}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- 女巫行动面板 -->
          <Card
            v-if="humanPlayer?.role === 'Witch' && gameStore.phase === 'NIGHT'"
            class="mt-4 border-purple-500/30 bg-purple-500/10"
          >
            <CardHeader class="pb-2">
              <CardTitle class="text-sm text-purple-400">女巫行动</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div
                v-if="
                  gameStore.nightActions.wolfTarget !== undefined &&
                  !gameStore.roleAbilities.witchHealUsed
                "
                class="text-sm text-slate-300"
              >
                狼人击杀了
                {{
                  gameStore.players.find((p) => p.seat === gameStore.nightActions.wolfTarget)
                    ?.displayName
                }}
              </div>
              <div class="flex gap-2">
                <Button
                  v-if="
                    gameStore.nightActions.wolfTarget !== undefined &&
                    !gameStore.roleAbilities.witchHealUsed
                  "
                  size="sm"
                  class="bg-purple-500 hover:bg-purple-600"
                  @click="witchSave"
                >
                  救人
                </Button>
                <Button size="sm" variant="outline" @click="witchPass"> 跳过 </Button>
              </div>
            </CardContent>
          </Card>

          <!-- 猎人开枪面板 -->
          <Card
            v-if="gameStore.phase === 'HUNTER_SHOOT' && humanPlayer?.role === 'Hunter'"
            class="mt-4 border-orange-500/30 bg-orange-500/10"
          >
            <CardHeader class="pb-2">
              <CardTitle class="text-sm text-orange-400">猎人开枪</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <p class="text-sm text-slate-300">选择要带走的目标，或跳过</p>
              <div class="flex gap-2">
                <Button size="sm" variant="outline" @click="hunterPass">跳过</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- 右侧：聊天和操作 -->
        <div class="lg:col-span-2">
          <!-- 聊天记录 -->
          <Card class="h-125 border-slate-700 bg-slate-900/50 backdrop-blur">
            <CardHeader class="pb-2">
              <CardTitle class="text-sm text-slate-400">聊天记录</CardTitle>
            </CardHeader>
            <CardContent class="flex h-[calc(100%-60px)] flex-col">
              <ScrollArea ref="chatScrollRef" class="flex-1 pr-4">
                <div class="space-y-3">
                  <template v-for="msg in gameStore.messages" :key="msg.id">
                    <!-- 系统消息 -->
                    <div v-if="msg.isSystem" class="py-2 text-center">
                      <span class="text-sm text-slate-500">{{ msg.content }}</span>
                    </div>
                    <!-- 玩家消息 -->
                    <div v-else class="flex gap-2">
                      <span class="shrink-0 text-sm font-medium text-slate-300"
                        >{{ msg.playerName }}:</span
                      >
                      <span
                        class="text-sm text-slate-200"
                        :class="msg.isLastWords && 'text-slate-400 italic'"
                      >
                        {{ msg.content }}
                      </span>
                    </div>
                  </template>
                </div>
              </ScrollArea>

              <Separator class="my-3" />

              <!-- 发言输入 -->
              <div
                v-if="
                  gameStore.phase === 'SPEECH' && gameStore.currentSpeakerSeat === humanPlayer?.seat
                "
                class="space-y-2"
              >
                <Input
                  v-model="humanInput"
                  placeholder="输入你的发言..."
                  class="border-slate-600 bg-slate-800 text-white"
                  @keyup.enter="submitSpeech"
                />
                <Button class="w-full" @click="submitSpeech" :disabled="!humanInput.trim()">
                  发言
                </Button>
              </div>

              <!-- 继续按钮 -->
              <Button
                v-else-if="!canHumanAct && gameStore.phase !== 'GAME_OVER'"
                class="w-full"
                @click="continueGame"
                :disabled="isProcessing"
              >
                <SkipForward v-if="!isProcessing" class="mr-2 h-4 w-4" />
                {{ isProcessing ? "处理中..." : "继续" }}
              </Button>

              <!-- 游戏结束 -->
              <div v-if="gameStore.phase === 'GAME_OVER'" class="py-4 text-center">
                <p
                  class="mb-2 text-2xl font-bold"
                  :class="gameStore.winner === 'wolf' ? 'text-red-400' : 'text-green-400'"
                >
                  {{ gameStore.winner === "wolf" ? "狼人胜利！" : "好人胜利！" }}
                </p>
                <Button variant="outline" @click="returnToLobby">返回大厅</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>

    <!-- 身份揭示对话框 -->
    <Dialog v-model:open="showRole">
      <DialogContent class="border-slate-700 bg-slate-900 text-white">
        <DialogHeader>
          <DialogTitle>你的身份</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col items-center py-6">
          <Avatar class="mb-4 h-24 w-24">
            <AvatarFallback :class="getRoleColor(humanPlayer?.role || 'Villager')">
              {{ humanPlayer?.role?.[0] || "V" }}
            </AvatarFallback>
          </Avatar>
          <h2 class="text-2xl font-bold">
            {{ getRoleDisplayName(humanPlayer?.role || "Villager") }}
          </h2>
          <p class="mt-2 text-slate-400">
            {{ humanPlayer?.alignment === "wolf" ? "你是狼人阵营" : "你是好人阵营" }}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
