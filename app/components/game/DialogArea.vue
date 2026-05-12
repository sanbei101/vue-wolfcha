<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { useGameStore } from "~/stores/game";
import type { Player } from "~/types/game";
import { getRoleDisplayName } from "~/types/game";

const props = defineProps<{
  currentSpeaker: Player | null;
  currentText: string;
  isTyping: boolean;
  reasoningContent?: string;
  humanInput: string;
  onInputChange: (text: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}>();

const gameStore = useGameStore();
const chatScrollRef = ref<HTMLElement | null>(null);

// 过滤掉系统提示消息
const visibleMessages = computed(() => {
  return gameStore.messages.filter((m) => !m.isSystem);
});

// 玩家头像URL

// 渲染 @X号 玩家标签

// 自动滚动
watch(
  () => gameStore.messages.length,
  async () => {
    await nextTick();
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight;
    }
  }
);

const humanPlayer = computed(() => gameStore.humanPlayer);
const isHumanTurn = computed(() => {
  return humanPlayer.value && gameStore.currentSpeakerSeat === humanPlayer.value.seat;
});
</script>

<template>
  <div class="flex h-full gap-4">
    <!-- 左侧：角色展示区 -->
    <div class="hidden md:flex w-50 shrink-0 flex-col items-center justify-end">
      <!-- 角色立绘/头像 -->
      <div class="relative flex flex-col items-center">
        <!-- 光晕效果 -->
        <div
          class="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-32 h-32 bg-gradient-radial from-primary/20 via-transparent to-transparent rounded-full blur-2xl"
        />

        <!-- 头像/立绘 -->
        <Avatar
          v-if="currentSpeaker"
          class="w-45 h-45 border-4 border-primary/30"
        >
          <AvatarFallback class="bg-primary/50 text-5xl text-primary-foreground">
            {{ currentSpeaker.displayName.slice(0, 2) }}
          </AvatarFallback>
        </Avatar>

        <!-- 角色名 -->
        <div v-if="currentSpeaker" class="mt-3 text-center">
          <div class="text-primary font-bold text-lg font-serif tracking-wide">
            {{ currentSpeaker.displayName }}
          </div>
          <Badge variant="outline" class="mt-1 text-xs">
            {{ getRoleDisplayName(currentSpeaker.role) }}
          </Badge>
        </div>
      </div>
    </div>

    <!-- 右侧：聊天历史 + 对话框 -->
    <div class="flex-1 min-w-0 flex flex-col">
      <!-- 聊天历史 -->
      <div class="flex-1 min-h-0">
        <ScrollArea ref="chatScrollRef" class="h-full pr-4">
          <div class="space-y-4">
            <!-- 历史消息 -->
            <div
              v-for="msg in visibleMessages"
              :key="msg.id"
              class="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <!-- 头像 -->
              <Avatar class="w-8 h-8 shrink-0">
                <AvatarFallback class="bg-muted text-xs text-muted-foreground">
                  {{ msg.playerName.slice(0, 2) }}
                </AvatarFallback>
              </Avatar>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-primary text-sm font-semibold">{{
                    msg.playerName
                  }}</span>
                  <span class="text-muted-foreground text-xs">{{ msg.isLastWords ? "(遗言)" : "" }}</span>
                </div>
                <p
                  class="text-foreground text-sm leading-relaxed">
                                  >
                  {{ msg.content }}
                </p>
              </div>
            </div>

            <!-- 分隔线 -->
            <div v-if="visibleMessages.length > 0" class="border-t border-border" />
          </div>
        </ScrollArea>
      </div>

      <!-- 底部对话框 -->
      <div class="shrink-0 pt-4">
        <Separator class="mb-4" />

        <!-- 思维链显示 -->
        <div
          v-if="reasoningContent"
          class="mb-4 p-3 rounded-lg bg-muted border border-border"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span class="text-primary text-xs font-medium">思维过程</span>
          </div>
          <p class="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {{ reasoningContent }}
          </p>
        </div>

        <!-- 当前对话 -->
        <div
          v-if="currentText || isTyping"
          class="mb-4 p-4 rounded-lg bg-primary/20 border border-primary/30"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="text-primary text-sm font-semibold">
              {{ currentSpeaker?.displayName || humanPlayer?.displayName }}
            </span>
            <Badge v-if="currentSpeaker?.isHuman" variant="outline" class="text-xs">
              你
            </Badge>
          </div>
          <p class="text-foreground text-base leading-relaxed">
            {{ currentText || "思考中..." }}
            <span v-if="isTyping" class="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
          </p>
        </div>

        <!-- 人类输入 -->
        <div v-if="isHumanTurn" class="space-y-2">
          <textarea
            :value="humanInput"
            @input="(e) => onInputChange((e.target as HTMLTextAreaElement).value)"
            @keydown.enter.exact.prevent="onSubmit"
            placeholder="输入你的发言... (Enter 发送)"
            rows="3"
            class="w-full bg-muted border border-border rounded-lg p-3 text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div class="flex gap-2">
            <Button @click="onSubmit" :disabled="!humanInput.trim()" class="flex-1">
              发言
            </Button>
            <Button variant="outline" @click="onSkip">跳过</Button>
          </div>
        </div>

        <!-- 继续按钮 -->
        <Button
          v-else-if="!isTyping"
          @click="onSkip"
          variant="outline"
          class="w-full"
        >
          继续
        </Button>

        <!-- 等待中 -->
        <div v-else class="text-center text-muted-foreground text-sm py-2">
          等待 AI 发言...
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-gradient-radial {
  background: radial-gradient(circle, var(--tw-gradient-stops));
}

.animate-in {
  animation: animateIn 0.3s ease-out;
}

@keyframes animateIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>