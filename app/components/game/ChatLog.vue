<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { ScrollArea } from '~/components/ui/scroll-area';
import { Separator } from '~/components/ui/separator';
import type { ChatMessage } from '~/types/game';

const props = defineProps<{
  messages: ChatMessage[];
}>();

const scrollRef = ref<InstanceType<typeof ScrollArea> | null>(null);

// 自动滚动到底部
watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    const viewport = scrollRef.value?.$el?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }
);

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div class="flex flex-col h-full">
    <ScrollArea ref="scrollRef" class="flex-1 pr-4">
      <div class="space-y-3">
        <template v-for="msg in messages" :key="msg.id">
          <!-- 系统消息 -->
          <div v-if="msg.isSystem" class="text-center py-2">
            <span class="text-slate-500 text-sm">{{ msg.content }}</span>
          </div>

          <!-- 玩家消息 -->
          <div v-else class="flex gap-3">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-slate-300 text-sm">{{ msg.playerName }}</span>
                <span class="text-xs text-slate-500">{{ formatTime(msg.timestamp) }}</span>
                <span v-if="msg.isLastWords" class="text-xs text-orange-400">(遗言)</span>
              </div>
              <p class="text-slate-200 text-sm" :class="{ 'italic text-slate-400': msg.isLastWords }">
                {{ msg.content }}
              </p>
            </div>
          </div>
        </template>
      </div>
    </ScrollArea>

    <Separator class="my-3" />

    <!-- 消息输入插槽 -->
    <div class="shrink-0">
      <slot />
    </div>
  </div>
</template>