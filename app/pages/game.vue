<script setup lang="ts">
import { Moon, Sun, ChevronLeft, SkipForward, Eye } from "lucide-vue-next";
import { computed, onMounted, ref, watch, nextTick } from "vue";
import { useRouter } from "vue-router";

import DialogArea from "~/components/game/DialogArea.vue";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { useGame } from "~/composables/useGame";
import { useLLM } from "~/composables/useLLM";
import { useGameStore } from "~/stores/game";
import { getRoleDisplayName } from "~/types/game";
import type { Player } from "~/types/game";

const router = useRouter();
const gameStore = useGameStore();
const { executeNightActions, checkAndEndGame } = useGame();

const isProcessing = ref(false);
const humanInput = ref("");
const showRole = ref(false);
const chatScrollRef = ref<HTMLElement | null>(null);

// 当前显示的文字和思维链
const currentText = ref("");
const reasoningContent = ref("");
const isTyping = ref(false);
const currentPlayer = ref<Player | null>(null);

// 跳转到大厅如果没在游戏中
onMounted(() => {
  if (gameStore.phase === "LOBBY") {
    router.push("/");
  }
});

// ============ 计算属性 ============

const isNight = computed(() => gameStore.phase === "NIGHT");

const phaseInfo = computed(() => {
  const phaseLabels: Record<string, { label: string; desc: string; icon: typeof Moon }> = {
    NIGHT: { label: "夜晚", desc: "狼人请睁眼...", icon: Moon },
    DAY_START: { label: "白天", desc: "天亮了，请等待...", icon: Sun },
    SPEECH: { label: "发言", desc: "请按顺序发言", icon: Sun },
    VOTE: { label: "投票", desc: "请投票放逐嫌疑人", icon: Sun },
    LAST_WORDS: { label: "遗言", desc: "临终遗言", icon: Moon },
    HUNTER_SHOOT: { label: "猎人", desc: "猎人请选择目标", icon: Moon },
    GAME_OVER: { label: "游戏结束", desc: "", icon: Moon },
  };
  return phaseLabels[gameStore.phase] || { label: "", desc: "", icon: Moon };
});

const currentPhaseIcon = computed(() => phaseInfo.value.icon);
const humanPlayer = computed(() => gameStore.humanPlayer);

const isHumanTurn = computed(() => {
  return humanPlayer.value && gameStore.currentSpeakerSeat === humanPlayer.value.seat;
});

// ============ 玩家选择 ============

function handlePlayerClick(seat: number) {
  if (!canClickPlayer.value) return;
  if (!humanPlayer.value?.alive) return;

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

// ============ 发言 ============

function submitSpeech() {
  if (!humanPlayer.value || !humanInput.value.trim()) return;
  gameStore.addPlayerMessage(humanPlayer.value.playerId, humanInput.value.trim());
  humanInput.value = "";
  gameStore.nextSpeaker();
  currentText.value = "";
  reasoningContent.value = "";
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
          humanPlayer.value?.alive &&
          humanPlayer.value?.role !== "Villager" &&
          humanPlayer.value?.role !== "Hunter"
        ) {
          return; // 等待人类行动
        }
        // AI 夜晚行动
        await executeNightActions();
        gameStore.setPhase("DAY_START");
        break;

      case "DAY_START":
        const deaths = gameStore.deaths;
        if (deaths.length > 0) {
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
        // AI 发言
        await executeDaySpeech();
        break;

      case "VOTE":
        // AI 投票
        await executeVote();
        break;

      case "HUNTER_SHOOT":
        if (humanPlayer.value?.role === "Hunter" && gameStore.roleAbilities.hunterCanShoot) {
          return; // 等待猎人行动
        }
        gameStore.nextPhase();
        break;
    }
  } finally {
    isProcessing.value = false;
  }
}

// ============ AI 发言逻辑 ============

async function executeDaySpeech() {
  // 逐个让 AI 发言
  while (gameStore.currentSpeakerSeat !== null) {
    const speaker = gameStore.currentSpeaker;
    if (!speaker) break;

    if (speaker.isHuman) {
      currentPlayer.value = speaker;
      isProcessing.value = false;
      return;
    }

    // AI 发言 - 显示思维链
    currentPlayer.value = speaker;
    isTyping.value = true;
    reasoningContent.value = "";

    try {
      // 生成发言
      const { generateSpeech } = useLLM();
      const context = buildSpeechContext();
      const result = await generateSpeech(speaker.role, context, speaker.displayName);

      // 显示思维链和内容
      currentText.value = result.content;
      reasoningContent.value = result.reasoning_content || "";

      // 添加到消息
      gameStore.addPlayerMessage(speaker.playerId, result.content);

      // 清空
      currentText.value = "";
      reasoningContent.value = "";
      isTyping.value = false;

      // 下一位
      gameStore.nextSpeaker();
    } catch (err) {
      console.error("AI speech error:", err);
      isTyping.value = false;
      currentText.value = "...";
      gameStore.addPlayerMessage(speaker.playerId, "...");
      gameStore.nextSpeaker();
    }
  }

  // 发言结束，进入投票
  if (gameStore.phase === "SPEECH") {
    gameStore.setPhase("VOTE");
  }
}

async function executeVote() {
  // AI 投票
  const alivePlayers = gameStore.alivePlayers.filter((p) => !p.isHuman);
  const llm = useLLM();

  for (const player of alivePlayers) {
    try {
      const gameState = buildVoteContext(player);
      const targets = gameStore.alivePlayers
        .filter((p) => p.playerId !== player.playerId)
        .map((p) => p.seat);

      const target = await llm.generateVote(gameState, targets);
      gameStore.castVote(player.playerId, target);
    } catch (err) {
      console.error("AI vote error:", err);
      const targets = gameStore.alivePlayers
        .filter((p) => p.playerId !== player.playerId)
        .map((p) => p.seat);
      if (targets.length > 0 && targets[0] !== undefined) {
        gameStore.castVote(player.playerId, targets[0]!);
      }
    }
  }

  // 结算投票
  const result = gameStore.resolveVote();

  if (result === null) {
    gameStore.addSystemMessage("投票平票，无人出局");
    gameStore.setPhase("SPEECH");
    gameStore.startDaySpeech();
  } else {
    const player = gameStore.players.find((p) => p.seat === result);
    gameStore.addSystemMessage(`${player?.displayName || "未知"}被投票出局`);
    if (player) player.alive = false;

    if (player?.role === "Hunter") {
      gameStore.setPhase("HUNTER_SHOOT");
    } else {
      gameStore.day++;
      gameStore.setPhase("NIGHT");
    }
  }
}

// ============ 上下文构建 ============

function buildSpeechContext(): string {
  const alivePlayers = gameStore.players.filter((p) => p.alive);
  const messages = gameStore.messages.slice(-20);

  let context = "【存活玩家】\n";
  alivePlayers.forEach((p) => {
    context += `${p.seat + 1}号位: ${p.displayName}\n`;
  });

  context += "\n【最近发言】\n";
  messages.forEach((msg) => {
    if (msg.isSystem) {
      context += `[系统]: ${msg.content}\n`;
    } else {
      context += `${msg.playerName}: ${msg.content}\n`;
    }
  });

  return context;
}

function buildVoteContext(voter: { playerId: string; role: string; displayName: string }): string {
  const alivePlayers = gameStore.players.filter((p) => p.alive);

  let context = `【投票玩家】${voter.displayName} (${voter.role})\n\n`;
  context += "【存活玩家】\n";
  alivePlayers.forEach((p) => {
    context += `${p.seat + 1}号位: ${p.displayName}\n`;
  });

  return context;
}

// ============ 人类行动判断 ============

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

  return false;
});

const canClickPlayer = computed(() => {
  if (!canHumanAct.value) return false;
  if (gameStore.phase === "NIGHT") {
    const role = humanPlayer.value?.role;
    return role === "Werewolf" || role === "Seer" || role === "Guard" || role === "Witch";
  }
  return gameStore.phase === "VOTE";
});

// ============ 返回大厅 ============

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
            :class="isNight ? 'text-muted-foreground' : 'text-primary'"
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
      class="border-border px-4 py-2 text-center text-sm"
      :class="isNight ? 'bg-muted text-muted-foreground' : 'bg-muted dark:bg-muted text-foreground'"
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
                    <AvatarFallback class="bg-primary/50 text-primary-foreground">
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
                    class="bg-accent text-accent-foreground absolute -top-1 -right-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
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
                  @click="gameStore.setNightAction({ witchSave: true })"
                >
                  救人
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  @click="gameStore.setNightAction({ witchSave: false })"
                >
                  跳过
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- 守卫行动面板 -->
          <Card v-if="humanPlayer?.role === 'Guard' && gameStore.phase === 'NIGHT'" class="mt-4">
            <CardHeader class="pb-2">
              <CardTitle class="text-primary text-sm">守卫行动</CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-muted-foreground mb-2 text-sm">点击要保护的玩家</p>
              <div class="text-muted-foreground text-xs">
                上一晚保护了:
                {{
                  gameStore.nightActions.lastGuardTarget !== undefined
                    ? `${gameStore.nightActions.lastGuardTarget + 1}号`
                    : "无"
                }}
              </div>
            </CardContent>
          </Card>
        </div>

        <!-- 右侧：对话框 + 聊天 -->
        <div class="lg:col-span-2">
          <Card class="h-150">
            <CardContent class="flex h-full flex-col p-4">
              <!-- 对话区域 -->
              <DialogArea
                :current-speaker="currentPlayer"
                :current-text="currentText"
                :is-typing="isTyping"
                :reasoning-content="reasoningContent"
                :human-input="humanInput"
                :on-input-change="(v: string) => (humanInput = v)"
                :on-submit="submitSpeech"
                :on-skip="continueGame"
              />

              <Separator class="my-3" />

              <!-- 聊天历史 -->
              <div class="min-h-0 flex-1">
                <ScrollArea ref="chatScrollRef" class="h-full pr-4">
                  <div class="space-y-3">
                    <template v-for="msg in gameStore.messages" :key="msg.id">
                      <div v-if="msg.isSystem" class="py-2 text-center">
                        <span class="text-muted-foreground text-sm">{{ msg.content }}</span>
                      </div>
                      <div v-else class="flex gap-2">
                        <span class="text-primary shrink-0 text-sm font-medium"
                          >{{ msg.playerName }}:</span
                        >
                        <span class="text-foreground text-sm">
                          {{ msg.content }}
                        </span>
                      </div>
                    </template>
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <!-- 处理中 -->
          <div v-if="isProcessing" class="text-muted-foreground py-4 text-center text-sm">
            处理中...
          </div>

          <!-- 游戏结束 -->
          <div v-if="gameStore.phase === 'GAME_OVER'" class="mt-4 py-4 text-center">
            <p
              class="mb-2 text-2xl font-bold"
              :class="gameStore.winner === 'wolf' ? 'text-destructive' : 'text-primary'"
            >
              {{ gameStore.winner === "wolf" ? "狼人胜利！" : "好人胜利！" }}
            </p>
            <Button variant="outline" @click="returnToLobby">返回大厅</Button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
