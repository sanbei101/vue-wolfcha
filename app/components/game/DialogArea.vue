<script setup lang="ts">
/**
 * DialogArea.vue
 *
 * 完整的对话区域组件,集成了:
 * - TalkingAvatar 说话嘴型动画
 * - TalkingAvatarSmall 聊天历史小头像
 * - 逐字打字机效果
 * - 消息入场动画
 * - 流式文本渲染
 * - 键盘/点击继续支持
 */

import { ref, computed, watch, nextTick } from "vue";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { useGameStore } from "~/stores/game";
import { getPlayerAvatarUrl } from "~/lib/avatar-config";
import TalkingAvatar from "~/components/game/TalkingAvatar.vue";
import TalkingAvatarSmall from "~/components/game/TalkingAvatarSmall.vue";
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

// ============ 玩家信息 ============

const humanPlayer = computed(() => gameStore.humanPlayer);

const isHumanTurn = computed(() => {
  return humanPlayer.value && gameStore.currentSpeakerSeat === humanPlayer.value.seat;
});

// ============ 聊天历史 ============

const visibleMessages = computed(() => {
  return gameStore.messages.filter((m) => !m.isSystem);
});

// 自动滚动到底部
watch(
  () => gameStore.messages.length,
  async () => {
    await nextTick();
    if (chatScrollRef.value) {
      chatScrollRef.value.scrollTop = chatScrollRef.value.scrollHeight;
    }
  }
);

// ============ 渲染 @X号 玩家标签 ============

function renderPlayerMentions(text: string): string {
  // 将 @X号 格式渲染为可高亮的标签
  return text.replace(/@(\d+)号?/g, (_, seat: string) => {
    const seatIndex = parseInt(seat) - 1;
    const player = gameStore.players.find((p) => p.seat === seatIndex);
    if (player) {
      return `<span class="wc-mention">@${seat}号</span>`;
    }
    return `@${seat}号`;
  });
}

// ============ 键盘快捷键 ============

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (props.isTyping) {
      // 跳过打字
      props.onSkip();
    } else if (isHumanTurn.value && props.humanInput.trim()) {
      // 发送发言
      props.onSubmit();
    } else {
      // 继续游戏
      props.onSkip();
    }
  }
}
</script>

<template>
  <div
    class="flex h-full gap-4"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <!-- 左侧:角色展示区 -->
    <div class="hidden md:flex w-55 lg:w-65 shrink-0 flex-col items-center justify-end">
      <!-- 角色头像 + 嘴型动画 -->
      <div class="relative flex flex-col items-center">
        <!-- 光晕效果 -->
        <div
          class="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-40 h-40 rounded-full blur-2xl bg-gradient-radial from-primary/20 via-transparent to-transparent"
        />

        <!-- 头像 - 带说话动画 -->
        <Transition name="portrait" mode="out-in">
          <TalkingAvatar
            v-if="currentSpeaker"
            :key="currentSpeaker.playerId"
            :seed="(currentSpeaker.avatarSeed ?? currentSpeaker.playerId)"
            :is-talking="isTyping"
            :scale="120"
            :translate-y="-5"
            class="w-55 lg:w-65 xl:w-75 h-auto object-contain"
            :alt="currentSpeaker.displayName"
          />
        </Transition>

        <!-- 角色名 -->
        <div v-if="currentSpeaker" class="mt-3 text-center">
          <div class="text-primary font-bold text-lg font-serif tracking-wide">
            {{ currentSpeaker.displayName }}
          </div>
          <Badge variant="outline" class="mt-1 text-xs">
            {{ getRoleDisplayName(currentSpeaker.role) }}
          </Badge>
        </div>

        <!-- 空状态占位 -->
        <div v-else class="flex items-end justify-center h-full pb-6">
          <span class="text-muted-foreground/20 text-5xl font-light select-none">
            ...
          </span>
        </div>
      </div>
    </div>

    <!-- 右侧:聊天历史 + 对话框 -->
    <div class="flex-1 min-w-0 flex flex-col">
      <!-- 聊天历史 -->
      <div class="flex-1 min-h-0">
        <ScrollArea ref="chatScrollRef" class="h-full pr-4">
          <div class="space-y-3">
            <!-- 历史消息 -->
            <TransitionGroup name="wc-msg" tag="div" class="space-y-3">
              <div
                v-for="msg in visibleMessages"
                :key="msg.id"
                class="flex items-start gap-3"
              >
                <!-- 小头像 -->
                <TalkingAvatarSmall
                  :seed="msg.playerId"
                  class="w-8 h-8 shrink-0"
                  :alt="msg.playerName"
                  :is-talking="false"
                />

                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-primary text-sm font-semibold">
                      {{ msg.playerName }}
                    </span>
                    <span class="text-muted-foreground text-xs">
                      {{ msg.isLastWords ? "(遗言)" : "" }}
                    </span>
                  </div>
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <p
                    class="text-foreground text-sm leading-relaxed whitespace-pre-wrap wrap-break-word"
                    v-html="renderPlayerMentions(msg.content)"
                  />
                </div>
              </div>
            </TransitionGroup>

            <!-- 分隔线 -->
            <div v-if="visibleMessages.length > 0" class="border-t border-border pt-3" />
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

        <!-- 当前对话 - 带打字机效果 -->
        <div
          v-if="currentText || isTyping"
          class="mb-4 p-4 rounded-lg bg-primary/10 border border-primary/20 transition-all"
        >
          <!-- 发言者名 -->
          <div class="flex items-center gap-2 mb-2">
            <span class="text-primary text-sm font-semibold">
              {{ currentSpeaker?.displayName || humanPlayer?.displayName }}
            </span>
            <!-- 说话状态指示 -->
            <span v-if="isTyping" class="flex items-center gap-1 text-xs text-muted-foreground">
              <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              发言中
            </span>
            <Badge v-if="currentSpeaker?.isHuman" variant="outline" class="text-xs">
              你
            </Badge>
          </div>

          <!-- 打字机文本 -->
          <p class="text-foreground text-base leading-relaxed whitespace-pre-wrap wrap-break-word">
            {{ currentText }}
            <!-- 打字光标 -->
            <span v-if="isTyping" class="wc-typing-cursor"></span>
          </p>

          <!-- 继续提示 -->
          <div
            v-if="!isTyping"
            class="flex items-center justify-end mt-3 pt-2 border-t border-border/50"
          >
            <kbd
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-muted text-muted-foreground text-xs font-mono"
            >
              Enter
            </kbd>
            <span class="ml-2 text-muted-foreground text-xs">继续</span>
          </div>
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
          v-else-if="!isTyping && !((gameStore.phase === 'NIGHT' || gameStore.phase === 'VOTE') && gameStore.canHumanAct)"
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
</style>
