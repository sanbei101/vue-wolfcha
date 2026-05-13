<script setup lang="ts">
/**
 * VotingProgress.vue
 *
 * 投票进度显示组件
 * 使用 Vue TransitionGroup 和 Tailwind 动画实现入场/退场动画
 */

import { computed } from "vue";
import type { Player } from "~/types/game";

const props = defineProps<{
  votes: Record<string, number>;
  players: Player[];
  humanPlayerId?: string;
  isWaiting?: boolean;
}>();

// 存活的玩家
const alivePlayers = computed(() => props.players.filter(p => p.alive));

// 已投票的玩家 ID 集合
const votedPlayerIds = computed(() => new Set(Object.keys(props.votes)));

// 投票进度统计
const totalVoters = computed(() => alivePlayers.value.length);
const votedCount = computed(() => {
  return alivePlayers.value.filter(p => votedPlayerIds.value.has(p.playerId)).length;
});

// 进度百分比
const progressPercent = computed(() => {
  return totalVoters.value > 0 ? (votedCount.value / totalVoters.value) * 100 : 0;
});

// 每个目标的投票详情
interface VoteTarget {
  seat: number;
  target: Player | undefined;
  voters: Player[];
  voteCount: number;
}

const voteTargets = computed((): VoteTarget[] => {
  const targetMap: Record<number, VoteTarget> = {};

  // 遍历所有投票
  Object.entries(props.votes).forEach(([voterId, targetSeat]) => {
    const voter = props.players.find(p => p.playerId === voterId);
    const target = props.players.find(p => p.seat === targetSeat);

    // 只统计存活玩家的投票
    if (!voter?.alive || !target?.alive) return;

    if (!targetMap[targetSeat]) {
      targetMap[targetSeat] = {
        seat: targetSeat,
        target,
        voters: [],
        voteCount: 0,
      };
    }
    targetMap[targetSeat].voters.push(voter);
    targetMap[targetSeat].voteCount += 1;
  });

  // 按票数降序排序
  return Object.values(targetMap).sort((a, b) => b.voteCount - a.voteCount);
});

// 未投票的玩家
const unvotedPlayers = computed(() => {
  return alivePlayers.value.filter(p => !votedPlayerIds.value.has(p.playerId));
});

// 格式化玩家名（截断过长的名字）
function truncateName(name: string, maxLength = 6): string {
  return name.length > maxLength ? name.slice(0, maxLength) + "..." : name;
}
</script>

<template>
  <div class="space-y-3">
    <!-- 进度条 -->
    <div class="flex items-center gap-3">
      <div class="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          class="h-full bg-primary transition-all duration-300 ease-out"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
      <span class="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
        {{ votedCount }} / {{ totalVoters }}
      </span>
    </div>

    <!-- 投票详情卡片 -->
    <div class="space-y-2">
      <TransitionGroup
        name="vote-card"
        tag="div"
        class="space-y-2"
      >
        <!-- 有投票时显示详情 -->
        <div
          v-for="{ seat, target, voters, voteCount } in voteTargets"
          :key="seat"
          class="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg border border-border"
        >
          <!-- 目标玩家信息 -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-destructive font-bold text-sm">
                {{ seat + 1 }}号
              </span>
              <span v-if="target" class="text-muted-foreground truncate text-xs max-w-20">
                {{ truncateName(target.displayName) }}
              </span>
            </div>
            <span class="text-primary font-semibold text-xs whitespace-nowrap">
              {{ voteCount }} 票
            </span>
          </div>

          <!-- 投票者标签 -->
          <div class="flex flex-wrap items-center gap-1.5">
            <TransitionGroup name="voter-tag" tag="div" class="flex flex-wrap gap-1">
              <span
                v-for="voter in voters"
                :key="voter.playerId"
                class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border"
                :class="[
                  voter.playerId === humanPlayerId
                    ? 'bg-primary text-primary-foreground font-bold border-primary'
                    : 'bg-background border-border text-muted-foreground'
                ]"
              >
                <!-- 勾选图标 -->
                <svg class="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {{ voter.seat + 1 }}号
              </span>
            </TransitionGroup>
          </div>
        </div>

        <!-- 无投票时显示等待状态 -->
        <div
          v-if="voteTargets.length === 0"
          key="waiting"
          class="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm"
        >
          <span
            v-if="isWaiting"
            class="w-2 h-2 rounded-full bg-primary animate-pulse"
          />
          <svg v-else class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{{ isWaiting ? '等待投票...' : '开始投票' }}</span>
        </div>
      </TransitionGroup>
    </div>

    <!-- 未投票玩家 -->
    <Transition name="fade-slide">
      <div
        v-if="unvotedPlayers.length > 0 && votedCount > 0"
        class="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <span>等待:</span>
        <div class="flex gap-1 flex-wrap">
          <span
            v-for="player in unvotedPlayers"
            :key="player.playerId"
            class="px-1.5 py-0.5 rounded"
            :class="[
              player.playerId === humanPlayerId
                ? 'bg-primary/10 text-primary font-bold'
                : 'bg-muted'
            ]"
          >
            {{ player.seat + 1 }}号{{ player.playerId === humanPlayerId ? '(你)' : '' }}
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* 投票卡片入场/退场动画 */
.vote-card-enter-active {
  transition: all 0.3s ease-out;
}
.vote-card-leave-active {
  transition: all 0.2s ease-in;
}
.vote-card-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
.vote-card-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
.vote-card-move {
  transition: transform 0.3s ease;
}

/* 投票者标签动画 */
.voter-tag-enter-active {
  transition: all 0.2s ease-out;
}
.voter-tag-leave-active {
  transition: all 0.15s ease-in;
}
.voter-tag-enter-from {
  opacity: 0;
  transform: scale(0.5);
}
.voter-tag-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

/* 淡入滑动动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>