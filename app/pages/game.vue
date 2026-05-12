<script setup lang="ts">
import { Moon, Sun, Users, Vote, Skull, Shield } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { useGame } from "~/composables/useGame";
import { cn } from "~/lib/utils";
import { useGameStore } from "~/stores/game";
import { getRoleDisplayName } from "~/types/game";

const router = useRouter();
const gameStore = useGameStore();
const { executeNightActions, executeDaySpeech, executeVote, checkAndEndGame } = useGame();

const isProcessing = ref(false);
const humanInput = ref("");
const showRole = ref(false);

// 跳转到大厅如果没在游戏中
onMounted(() => {
  if (gameStore.phase === "LOBBY") {
    router.push("/");
  }
});

// ============ 计算属性 ============

const phaseInfo = computed(() => {
  const phaseLabels: Record<string, { label: string; desc: string; icon: typeof Moon }> = {
    NIGHT: { label: "夜晚", desc: "狼人请睁眼...", icon: Moon },
    DAY_START: { label: "白天", desc: "天亮了", icon: Sun },
    SPEECH: { label: "发言", desc: "请按顺序发言", icon: Users },
    VOTE: { label: "投票", desc: "请投票放逐玩家", icon: Vote },
    LAST_WORDS: { label: "遗言", desc: "临终遗言", icon: Skull },
    HUNTER_SHOOT: { label: "猎人", desc: "猎人请开枪", icon: Skull },
    GAME_OVER: { label: "游戏结束", desc: "", icon: Skull },
  };
  return phaseLabels[gameStore.phase] || { label: "", desc: "", icon: Moon };
});

const currentPhaseIcon = computed(() => phaseInfo.value.icon);

// ============ 玩家选择 ============

function selectPlayer(seat: number) {
  if (!gameStore.humanCanSelectPlayer) return;

  const human = gameStore.humanPlayer;
  if (!human) return;

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
  const human = gameStore.humanPlayer;
  if (!human) return;

  switch (human.role) {
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
      gameStore.setNightAction({ guardTarget: seat });
      break;
    case "Witch":
      // 女巫需要两个操作
      break;
  }
}

function handleVote(seat: number) {
  const human = gameStore.humanPlayer;
  if (!human) return;

  gameStore.castVote(human.playerId, seat);
}

// ============ 人类发言 ============

function submitSpeech() {
  const human = gameStore.humanPlayer;
  if (!human || !humanInput.value.trim()) return;

  gameStore.addPlayerMessage(human.playerId, humanInput.value.trim());
  humanInput.value = "";
  gameStore.nextSpeaker();
}

// ============ 女巫行动 ============

function witchSave() {
  gameStore.setNightAction({ witchSave: true });
}

function witchPoison(seat: number) {
  gameStore.setNightAction({ witchPoison: seat });
}

function witchPass() {
  // 女巫跳过
  if (gameStore.nightActions.wolfTarget !== undefined && !gameStore.roleAbilities.witchHealUsed) {
    gameStore.setNightAction({ witchSave: false });
  }
}

// ============ 猎人开枪 ============

function hunterShoot(seat: number) {
  gameStore.hunterShoot(seat);
  gameStore.nextPhase();
}

function hunterPass() {
  gameStore.hunterShoot(null);
  gameStore.nextPhase();
}

// ============ 游戏流程 ============

async function continueGame() {
  if (isProcessing.value) return;
  isProcessing.value = true;

  try {
    const winner = checkAndEndGame();
    if (winner) return;

    switch (gameStore.phase) {
      case "NIGHT":
        // 检查人类是否已完成夜晚行动
        if (!gameStore.isHumanNightAction) {
          return; // 等待人类输入
        }
        await executeNightActions();
        gameStore.setPhase("DAY_START");
        break;

      case "DAY_START":
        // 显示死亡信息
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
        gameStore.setPhase("SPEECH");
        gameStore.startDaySpeech();
        break;

      case "SPEECH":
        if (gameStore.currentSpeakerSeat !== null) {
          return; // 等待当前发言者
        }
        // 所有发言完毕,进入投票
        gameStore.setPhase("VOTE");
        await executeVote();
        break;

      case "VOTE":
        // 投票已由 executeVote 处理
        // 检查游戏是否结束
        const w = checkAndEndGame();
        if (!w) {
          // 进入下一夜
          gameStore.day++;
          gameStore.setPhase("NIGHT");
        }
        break;
    }
  } finally {
    isProcessing.value = false;
  }
}

function showHumanRole() {
  showRole.value = true;
}

function returnToLobby() {
  gameStore.reset();
  router.push("/");
}

// ============ 辅助函数 ============

function getRoleIcon(role: string) {
  const icons: Record<string, typeof Skull> = {
    Werewolf: Skull,
    Seer: Sun,
    Witch: Moon,
    Guard: Shield,
    Hunter: Skull,
    Villager: Users,
  };
  return icons[role] || Users;
}

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
</script>

<template>
  <div class="min-h-screen bg-slate-900 text-white">
    <!-- 顶部信息栏 -->
    <header class="border-b border-slate-700 bg-slate-800 p-4">
      <div class="mx-auto flex max-w-4xl items-center justify-between">
        <div class="flex items-center gap-3">
          <component :is="currentPhaseIcon" class="h-6 w-6" />
          <span class="text-lg font-medium">{{ phaseInfo.label }}</span>
          <Badge v-if="gameStore.phase !== 'LOBBY'" variant="secondary">
            第 {{ gameStore.day }} 天
          </Badge>
        </div>
        <Button variant="outline" size="sm" @click="showHumanRole"> 我的身份 </Button>
      </div>
    </header>

    <!-- 阶段描述 -->
    <div class="border-b border-slate-700 bg-slate-800/50 p-2 text-center text-slate-400">
      {{ phaseInfo.desc }}
    </div>

    <!-- 人类玩家状态提示 -->
    <div
      v-if="gameStore.canHumanAct"
      class="border-b border-blue-700 bg-blue-900/50 p-3 text-center"
    >
      <span class="text-blue-200">轮到你行动了!</span>
    </div>

    <!-- 主内容 -->
    <main class="mx-auto grid max-w-4xl grid-cols-1 gap-4 p-4 lg:grid-cols-3">
      <!-- 左侧:玩家列表 -->
      <div class="space-y-4 lg:col-span-1">
        <Card class="border-slate-700 bg-slate-800">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm text-slate-300">玩家列表</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2">
            <div
              v-for="player in gameStore.players"
              :key="player.playerId"
              class="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors"
              :class="[
                player.alive ? 'hover:bg-slate-700' : 'opacity-50',
                gameStore.humanCanSelectPlayer && player.alive
                  ? 'cursor-pointer ring-2 ring-blue-500'
                  : '',
                gameStore.currentSpeakerSeat === player.seat
                  ? 'bg-blue-900/30 ring-2 ring-blue-400'
                  : '',
              ]"
              @click="selectPlayer(player.seat)"
            >
              <Avatar class="h-8 w-8">
                <AvatarFallback :class="getRoleColor(player.role)">
                  {{ player.seat + 1 }}
                </AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate font-medium" :class="{ 'text-yellow-400': player.isHuman }">
                    {{ player.displayName }}
                  </span>
                  <Badge v-if="!player.alive" variant="destructive" class="text-xs">死亡</Badge>
                  <Badge
                    v-if="gameStore.currentSpeakerSeat === player.seat"
                    variant="secondary"
                    class="text-xs"
                  >
                    发言中
                  </Badge>
                </div>
                <div class="text-xs text-slate-400">
                  座位 {{ player.seat + 1 }}
                  <span
                    v-if="gameStore.nightActions.seerResult?.targetSeat === player.seat"
                    class="text-yellow-400"
                  >
                    ({{ gameStore.nightActions.seerResult.isWolf ? "狼人" : "好人" }})
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 人类玩家特殊操作 -->
        <Card
          v-if="gameStore.humanPlayer?.role === 'Witch' && gameStore.phase === 'NIGHT'"
          class="border-slate-700 bg-slate-800"
        >
          <CardHeader class="pb-2">
            <CardTitle class="text-sm text-slate-300">女巫行动</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2">
            <div class="mb-2 text-sm text-slate-400">
              <div
                v-if="
                  gameStore.nightActions.wolfTarget !== undefined &&
                  !gameStore.roleAbilities.witchHealUsed
                "
              >
                狼人击杀了
                {{
                  gameStore.players.find((p) => p.seat === gameStore.nightActions.wolfTarget)
                    ?.displayName
                }},是否救人?
              </div>
              <div v-else class="text-slate-500">没有需要救的人</div>
            </div>
            <div class="flex gap-2">
              <Button
                v-if="
                  gameStore.nightActions.wolfTarget !== undefined &&
                  !gameStore.roleAbilities.witchHealUsed
                "
                size="sm"
                @click="witchSave"
              >
                救人
              </Button>
              <Button size="sm" variant="outline" @click="witchPass">跳过</Button>
            </div>
          </CardContent>
        </Card>

        <!-- 猎人开枪 -->
        <Card v-if="gameStore.phase === 'HUNTER_SHOOT'" class="border-slate-700 bg-slate-800">
          <CardHeader class="pb-2">
            <CardTitle class="text-sm text-slate-300">猎人开枪</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2">
            <p class="mb-2 text-sm text-slate-400">选择要带走的目标,或跳过</p>
            <div class="flex gap-2">
              <Button size="sm" @click="hunterPass">跳过</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 中间:聊天记录 -->
      <div class="lg:col-span-2">
        <Card class="flex h-125 flex-col border-slate-700 bg-slate-800">
          <CardHeader class="shrink-0 pb-2">
            <CardTitle class="text-sm text-slate-300">聊天记录</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-1 flex-col overflow-hidden">
            <ScrollArea class="flex-1 pr-4">
              <div class="space-y-3">
                <div v-for="msg in gameStore.messages" :key="msg.id" class="text-sm">
                  <div v-if="msg.isSystem" class="py-1 text-center text-slate-500">
                    {{ msg.content }}
                  </div>
                  <div v-else class="flex gap-2">
                    <span class="font-medium text-slate-300">{{ msg.playerName }}:</span>
                    <span :class="{ 'text-slate-400 italic': msg.isLastWords }">{{
                      msg.content
                    }}</span>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <Separator class="my-3" />

            <!-- 发言输入 -->
            <div v-if="gameStore.isHumanTurn" class="flex gap-2">
              <Input
                v-model="humanInput"
                placeholder="输入你的发言..."
                class="border-slate-600 bg-slate-900"
                @keyup.enter="submitSpeech"
              />
              <Button @click="submitSpeech">发言</Button>
            </div>

            <!-- 继续按钮 -->
            <Button
              v-else-if="!gameStore.canHumanAct && gameStore.phase !== 'GAME_OVER'"
              class="mt-3"
              @click="continueGame"
              :disabled="isProcessing"
            >
              {{ isProcessing ? "处理中..." : "继续" }}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>

    <!-- 身份揭示对话框 -->
    <Dialog v-model:open="showRole">
      <DialogContent class="border-slate-700 bg-slate-800 text-white">
        <DialogHeader>
          <DialogTitle>你的身份</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col items-center py-6">
          <Avatar class="mb-4 h-24 w-24">
            <AvatarFallback :class="getRoleColor(gameStore.humanPlayer?.role || 'Villager')">
              {{ gameStore.humanPlayer?.role?.[0] || "V" }}
            </AvatarFallback>
          </Avatar>
          <h2 class="text-2xl font-bold">
            {{ getRoleDisplayName(gameStore.humanPlayer?.role || "Villager") }}
          </h2>
          <p class="mt-2 text-slate-400">
            {{ gameStore.humanPlayer?.alignment === "wolf" ? "你是狼人阵营" : "你是好人阵营" }}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
