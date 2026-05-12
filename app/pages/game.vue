<script setup lang="ts">
import { Moon, Sun, Users, Vote, Skull, ChevronLeft, SkipForward } from "lucide-vue-next";
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

const router = useRouter();
const gameStore = useGameStore();
const { executeNightActions, checkAndEndGame } = useGame();

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
        return canSave || !gameStore.roleAbilities.witchPoisonUsed;
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

  return gameStore.phase === "VOTE";
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
      if (gameStore.nightActions.lastGuardTarget === seat) return;
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
    const winner = checkAndEndGame();
    if (winner) return;

    switch (gameStore.phase) {
      case "NIGHT":
        if (
          canHumanAct.value &&
          humanPlayer.value?.role !== "Villager" &&
          humanPlayer.value?.role !== "Hunter"
        ) {
          return;
        }
        await executeNightActions();
        gameStore.setPhase("DAY_START");
        break;

      case "DAY_START":
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
        gameStore.deaths = [];
        gameStore.setPhase("SPEECH");
        gameStore.startDaySpeech();
        break;

      case "SPEECH":
        if (gameStore.currentSpeakerSeat !== null) return;
        gameStore.setPhase("VOTE");
        break;

      case "VOTE":
        const voteResult = gameStore.resolveVote();
        if (voteResult === null) {
          gameStore.addSystemMessage("投票平票，无人出局");
          gameStore.setPhase("SPEECH");
          gameStore.startDaySpeech();
        } else {
          const player = gameStore.players.find((p) => p.seat === voteResult);
          gameStore.addSystemMessage(`${player?.displayName || "未知"}被投票出局`);
          if (player) player.alive = false;

          if (player?.role === "Hunter") {
            gameStore.setPhase("HUNTER_SHOOT");
          } else {
            gameStore.day++;
            gameStore.setPhase("NIGHT");
          }
        }
        break;

      case "HUNTER_SHOOT":
        if (humanPlayer.value?.role === "Hunter" && gameStore.roleAbilities.hunterCanShoot) {
          return;
        }
        const alivePlayers = gameStore.alivePlayers;
        if (alivePlayers.length > 0 && humanPlayer.value?.role !== "Hunter") {
          const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)]!;
          gameStore.hunterShoot(target.seat);
        }
        gameStore.nextPhase();
        break;
    }
  } finally {
    isProcessing.value = false;
  }
}

function returnToLobby() {
  gameStore.reset();
  router.push("/");
}
</script>

<template>
  <div class="bg-background text-foreground min-h-screen">
    <!-- 顶部导航栏 -->
    <header
      class="border-border bg-background/95 sticky top-0 z-50 border-b px-4 py-3 backdrop-blur"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" @click="returnToLobby">
            <ChevronLeft class="h-5 w-5" />
          </Button>
          <component
            :is="currentPhaseIcon"
            class="h-6 w-6"
            :class="isNight ? 'text-primary' : 'text-primary'"
          />
          <span class="text-foreground text-lg font-semibold">{{ phaseInfo.label }}</span>
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
      class="border-border bg-muted/50 text-muted-foreground border-b px-4 py-2 text-center text-sm"
    >
      {{ phaseInfo.desc }}
    </div>

    <!-- 人类行动提示 -->
    <div
      v-if="canHumanAct"
      class="border-primary/30 bg-primary/10 animate-pulse border-b px-4 py-3 text-center"
    >
      <span class="text-primary font-medium">轮到你行动了！</span>
    </div>

    <!-- 主内容 -->
    <main class="mx-auto max-w-6xl p-4">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- 左侧：玩家列表 -->
        <div class="lg:col-span-1">
          <Card>
            <CardHeader class="pb-2">
              <CardTitle class="text-muted-foreground text-sm">
                玩家 ({{ gameStore.players.length }})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="player in gameStore.players"
                  :key="player.playerId"
                  class="relative flex items-center gap-3 rounded-lg p-3 transition-all"
                  :class="[
                    !player.alive && 'opacity-50 grayscale',
                    canClickPlayer && player.alive && 'hover:bg-muted cursor-pointer',
                    gameStore.currentSpeakerSeat === player.seat &&
                      'bg-primary/10 ring-primary ring-2',
                  ]"
                  @click="handlePlayerClick(player.seat)"
                >
                  <Avatar class="h-10 w-10">
                    <AvatarFallback class="bg-primary text-primary-foreground">
                      {{ player.seat + 1 }}
                    </AvatarFallback>
                  </Avatar>

                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1">
                      <span
                        class="text-foreground truncate text-sm font-medium"
                        :class="player.isHuman && 'text-primary'"
                      >
                        {{ player.displayName }}
                      </span>
                      <Badge v-if="player.isHuman" variant="outline" class="px-1 py-0 text-[10px]">
                        你
                      </Badge>
                    </div>
                    <div class="text-muted-foreground flex items-center gap-1 text-xs">
                      <span>座位 {{ player.seat + 1 }}</span>
                      <span v-if="!player.alive" class="text-destructive">死亡</span>
                    </div>
                  </div>

                  <!-- 预言家查验结果 -->
                  <div
                    v-if="gameStore.nightActions.seerResult?.targetSeat === player.seat"
                    class="bg-primary text-primary-foreground absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  >
                    {{ gameStore.nightActions.seerResult.isWolf ? "狼" : "好" }}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- 女巫行动面板 -->
          <Card v-if="humanPlayer?.role === 'Witch' && gameStore.phase === 'NIGHT'" class="mt-4">
            <CardHeader class="pb-2">
              <CardTitle class="text-primary text-sm">女巫行动</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div
                v-if="
                  gameStore.nightActions.wolfTarget !== undefined &&
                  !gameStore.roleAbilities.witchHealUsed
                "
                class="text-muted-foreground text-sm"
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
            class="mt-4"
          >
            <CardHeader class="pb-2">
              <CardTitle class="text-primary text-sm">猎人开枪</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <p class="text-muted-foreground text-sm">选择要带走的目标，或跳过</p>
              <div class="flex gap-2">
                <Button size="sm" variant="outline" @click="hunterPass">跳过</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- 右侧：聊天和操作 -->
        <div class="lg:col-span-2">
          <!-- 聊天记录 -->
          <Card class="h-125">
            <CardHeader class="pb-2">
              <CardTitle class="text-muted-foreground text-sm">聊天记录</CardTitle>
            </CardHeader>
            <CardContent class="flex h-[calc(100%-60px)] flex-col">
              <ScrollArea ref="chatScrollRef" class="flex-1 pr-4">
                <div class="space-y-3">
                  <template v-for="msg in gameStore.messages" :key="msg.id">
                    <div v-if="msg.isSystem" class="py-2 text-center">
                      <span class="text-muted-foreground text-sm">{{ msg.content }}</span>
                    </div>
                    <div v-else class="flex gap-2">
                      <span class="text-foreground shrink-0 text-sm font-medium"
                        >{{ msg.playerName }}:</span
                      >
                      <span
                        class="text-muted-foreground text-sm"
                        :class="msg.isLastWords && 'italic'"
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
                  :class="gameStore.winner === 'wolf' ? 'text-destructive' : 'text-primary'"
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
      <DialogContent class="bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>你的身份</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col items-center py-6">
          <Avatar class="mb-4 h-24 w-24">
            <AvatarFallback class="bg-primary text-primary-foreground">
              {{ humanPlayer?.role?.[0] || "V" }}
            </AvatarFallback>
          </Avatar>
          <h2 class="text-foreground text-2xl font-bold">
            {{ getRoleDisplayName(humanPlayer?.role || "Villager") }}
          </h2>
          <p class="text-muted-foreground mt-2">
            {{ humanPlayer?.alignment === "wolf" ? "你是狼人阵营" : "你是好人阵营" }}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
