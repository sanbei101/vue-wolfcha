<script setup lang="ts">
import { computed } from 'vue';
import { Badge } from '~/components/ui/badge';
import { Moon, Sun, Users, Vote, Skull, Shield } from 'lucide-vue-next';
import type { Phase } from '~/types/game';

const props = defineProps<{
  phase: Phase;
  day: number;
}>();

const phaseInfo = computed(() => {
  const info: Record<Phase, { label: string; desc: string; icon: typeof Moon }> = {
    LOBBY: { label: '大厅', desc: '等待开始', icon: Moon },
    NIGHT: { label: '夜晚', desc: '狼人请睁眼...', icon: Moon },
    DAY_START: { label: '白天', desc: '天亮了', icon: Sun },
    SPEECH: { label: '发言', desc: '请按顺序发言', icon: Users },
    VOTE: { label: '投票', desc: '请投票放逐玩家', icon: Vote },
    LAST_WORDS: { label: '遗言', desc: '临终遗言', icon: Skull },
    HUNTER_SHOOT: { label: '猎人', desc: '猎人请开枪', icon: Skull },
    GAME_OVER: { label: '游戏结束', desc: '', icon: Skull },
    REVEAL: { label: '身份揭示', desc: '', icon: Shield },
  };
  return info[props.phase] || { label: '', desc: '', icon: Moon };
});

const iconComponent = computed(() => phaseInfo.value.icon);
</script>

<template>
  <div class="flex items-center gap-4">
    <div class="flex items-center gap-2">
      <component :is="iconComponent" class="w-6 h-6 text-slate-400" />
      <span class="text-lg font-medium text-white">{{ phaseInfo.label }}</span>
    </div>

    <Badge v-if="phase !== 'LOBBY' && phase !== 'GAME_OVER'" variant="secondary">
      第 {{ day }} 天
    </Badge>

    <span class="text-sm text-slate-400">{{ phaseInfo.desc }}</span>
  </div>
</template>