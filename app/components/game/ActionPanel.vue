<script setup lang="ts">
import { computed } from "vue";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import type { Phase, Player } from "~/types/game";

const props = defineProps<{
  phase: Phase;
  humanPlayer: Player | undefined;
  canAct: boolean;
  isProcessing: boolean;
}>();

const emit = defineEmits<{
  submitSpeech: [content: string];
  continue: [];
  vote: [seat: number];
  nightAction: [seat: number];
  witchAction: ["save" | "poison" | "pass"];
  hunterAction: [seat: number | null];
}>();

const humanInput = ref("");

const phaseTitle = computed(() => {
  const titles: Record<Phase, string> = {
    NIGHT: "夜晚行动",
    SPEECH: "发言",
    VOTE: "投票",
    HUNTER_SHOOT: "猎人开枪",
    LOBBY: "",
    DAY_START: "",
    LAST_WORDS: "",
    GAME_OVER: "",
    REVEAL: "",
  };
  return titles[props.phase] || "";
});

function submitSpeech() {
  if (humanInput.value.trim()) {
    emit("submitSpeech", humanInput.value.trim());
    humanInput.value = "";
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    submitSpeech();
  }
}

const humanRoleDescription = computed(() => {
  if (!props.humanPlayer) return "";
  const desc: Record<string, string> = {
    Werewolf: "选择今晚要击杀的目标",
    Seer: "选择今晚要查验的目标",
    Witch: "决定是否使用药水",
    Guard: "选择今晚要保护的目标",
    Hunter: "选择要带走的目标,或跳过",
    Villager: "等待发言",
  };
  return desc[props.humanPlayer.role] || "";
});
</script>

<template>
  <Card class="bg-slate-800 border-slate-700">
    <CardHeader class="pb-2">
      <CardTitle class="text-white text-lg">{{ phaseTitle }}</CardTitle>
      <p v-if="humanRoleDescription" class="text-sm text-slate-400">{{ humanRoleDescription }}</p>
    </CardHeader>

    <CardContent class="space-y-3">
      <!-- 人类发言输入 -->
      <template v-if="phase === 'SPEECH' && canAct">
        <Input
          v-model="humanInput"
          placeholder="输入你的发言..."
          class="bg-slate-900 border-slate-600 text-white"
          @keyup="handleKeyUp"
        />
        <Button class="w-full" @click="submitSpeech" :disabled="!humanInput.trim()"> 发言 </Button>
      </template>

      <!-- 继续按钮 -->
      <Button
        v-if="phase !== 'SPEECH' && !canAct && phase !== 'GAME_OVER'"
        class="w-full"
        @click="emit('continue')"
        :disabled="isProcessing"
      >
        {{ isProcessing ? "处理中..." : "继续" }}
      </Button>

      <!-- 女巫行动 -->
      <template v-if="phase === 'NIGHT' && humanPlayer?.role === 'Witch' && canAct">
        <div class="text-sm text-slate-400">
          <template v-if="!humanPlayer.alive">你已死亡,等待天亮</template>
          <template v-else>
            <template v-if="$props as any">
              <!-- 女巫可以救人或毒人 -->
            </template>
          </template>
        </div>
      </template>

      <!-- 等待状态 -->
      <div v-if="canAct" class="text-center text-blue-400">
        <span class="animate-pulse">等待你的行动...</span>
      </div>

      <!-- 游戏结束 -->
      <template v-if="phase === 'GAME_OVER'">
        <div class="text-center py-4">
          <p class="text-lg font-medium text-white">
            {{ humanPlayer?.alignment === "wolf" ? "狼人胜利!" : "好人胜利!" }}
          </p>
        </div>
        <Button class="w-full" variant="outline" @click="emit('continue')"> 返回大厅 </Button>
      </template>
    </CardContent>
  </Card>
</template>
