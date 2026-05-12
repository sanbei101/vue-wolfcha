<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '~/components/ui/badge';
import { Avatar, AvatarFallback } from '~/components/ui/avatar';
import type { Player } from '~/types/game';

const props = defineProps<{
  player: Player;
  isCurrentSpeaker?: boolean;
  isHuman?: boolean;
  isSelectable?: boolean;
  seerResult?: { isWolf: boolean } | null;
}>();

const emit = defineEmits<{
  select: [seat: number];
}>();

const roleColor = computed(() => {
  const colors: Record<string, string> = {
    Werewolf: 'bg-red-500',
    Seer: 'bg-yellow-500',
    Witch: 'bg-purple-500',
    Guard: 'bg-blue-500',
    Hunter: 'bg-orange-500',
    Villager: 'bg-green-500',
  };
  return colors[props.player.role] || 'bg-gray-500';
});

function handleClick() {
  if (props.isSelectable && props.player.alive) {
    emit('select', props.player.seat);
  }
}
</script>

<template>
  <div
    class="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all"
    :class="[
      player.alive ? 'hover:bg-slate-700' : 'opacity-50 cursor-default',
      isSelectable && player.alive ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-800' : '',
      isCurrentSpeaker ? 'bg-blue-900/30 ring-2 ring-blue-400' : '',
    ]"
    @click="handleClick"
  >
    <Avatar class="w-10 h-10">
      <AvatarFallback :class="roleColor">
        {{ player.seat + 1 }}
      </AvatarFallback>
    </Avatar>

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="font-medium truncate" :class="{ 'text-yellow-400': isHuman }">
          {{ player.displayName }}
        </span>
        <Badge v-if="isHuman" variant="secondary" class="text-xs">你</Badge>
        <Badge v-if="!player.alive" variant="destructive" class="text-xs">死亡</Badge>
        <Badge v-if="isCurrentSpeaker" variant="outline" class="text-xs">发言中</Badge>
      </div>

      <div class="flex items-center gap-2 text-xs text-slate-400">
        <span>座位 {{ player.seat + 1 }}</span>
        <span v-if="isHuman && seerResult" class="font-medium" :class="seerResult.isWolf ? 'text-red-400' : 'text-green-400'">
          ({{ seerResult.isWolf ? '狼人' : '好人' }})
        </span>
      </div>
    </div>

    <!-- 投票指示器 -->
    <div v-if="isSelectable" class="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
  </div>
</template>