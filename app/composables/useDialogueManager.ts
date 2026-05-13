/**
 * Dialogue Manager Composable
 *
 * 管理游戏中 AI 角色发言的队列系统：
 * - 流式接收 LLM 响应，实时切分为多个发言段
 * - 发言队列自动推进
 * - 支持预加载/预取 TTS 音频
 * - 流式和非流式两种初始化模式
 */

import { ref, shallowRef } from "vue";

import type { Player } from "~/types/game";

export interface DialogueState {
  speaker: string;
  text: string;
  isStreaming: boolean;
}

interface SpeechQueueState {
  segments: string[];
  currentIndex: number;
  player: Player;
  isStreaming: boolean;
  isFinalized: boolean;
  completedIndices: Set<number>;
  awaitingNextSegment: boolean;
}

export interface PrefetchCriteria {
  playerId: string;
  phase: string;
  day: number;
  messageCount: number;
}

export interface PrefetchedSpeech {
  playerId: string;
  phase: string;
  day: number;
  messageCount: number;
  segments: string[];
  isComplete: boolean;
  createdAt: number;
}

export function useDialogueManager() {
  const currentDialogue = ref<DialogueState | null>(null);
  const isWaitingForAI = ref(false);
  const waitingForNextRound = ref(false);

  // 使用 shallowRef 避免深层响应开销
  const speechQueue = shallowRef<SpeechQueueState | null>(null);
  const prefetchedSpeech = shallowRef<PrefetchedSpeech | null>(null);

  /** 设置当前对话内容（单一对话，非队列） */
  function setDialogue(speaker: string, text: string, isStreaming = false) {
    currentDialogue.value = { speaker, text, isStreaming };
  }

  /** 清除对话 */
  function clearDialogue() {
    currentDialogue.value = null;
  }

  /**
   * 初始化发言队列（预先知道所有段落）
   */
  function initSpeechQueue(segments: string[], player: Player, afterSpeech?: () => void) {
    const normalizedSegments = segments.map((s) => s.trim()).filter((s) => s.length > 0);

    speechQueue.value = {
      segments: normalizedSegments,
      currentIndex: 0,
      player,
      isStreaming: true,
      isFinalized: false,
      completedIndices: new Set(),
      awaitingNextSegment: false,
    };

    if (normalizedSegments.length > 0) {
      currentDialogue.value = {
        speaker: player.displayName,
        text: normalizedSegments[0]!,
        isStreaming: true,
      };
    }
  }

  /**
   * 初始化流式发言队列（实时追加段落）
   */
  function initStreamingSpeechQueue(player: Player, afterSpeech?: () => void) {
    speechQueue.value = {
      segments: [],
      currentIndex: 0,
      player,
      isStreaming: true,
      isFinalized: false,
      completedIndices: new Set(),
      awaitingNextSegment: false,
    };
  }

  /**
   * 向流式队列追加新段落
   */
  function appendToSpeechQueue(segment: string) {
    const queue = speechQueue.value;
    if (!queue) return;

    const trimmed = segment.trim();
    if (!trimmed) return;

    // 去重
    if (queue.segments.includes(trimmed)) return;

    const isFirst = queue.segments.length === 0;
    const isAwaiting = queue.awaitingNextSegment === true;

    queue.segments.push(trimmed);

    // 如果是第一个段落，或用户正在等待下一段，立即显示
    if (isFirst || isAwaiting) {
      queue.currentIndex = queue.segments.length - 1;
      queue.awaitingNextSegment = false;
      currentDialogue.value = {
        speaker: queue.player.displayName,
        text: trimmed,
        isStreaming: true,
      };
    }
  }

  /**
   * 标记当前段落已完成显示
   */
  function markCurrentSegmentCompleted() {
    const queue = speechQueue.value;
    if (!queue) return;
    queue.completedIndices.add(queue.currentIndex);
  }

  /**
   * 检查当前段落是否已完成显示
   */
  function isCurrentSegmentCompleted(): boolean {
    const queue = speechQueue.value;
    if (!queue) return false;
    return queue.completedIndices.has(queue.currentIndex);
  }

  /**
   * 标记流式队列完成接收
   */
  function finalizeSpeechQueue() {
    const queue = speechQueue.value;
    if (!queue) return;
    queue.isStreaming = false;
    queue.isFinalized = true;
  }

  /**
   * 推进发言队列到下一段
   */
  function advanceSpeechQueue(): { finished: boolean; afterSpeech?: () => void } {
    const queue = speechQueue.value;
    if (!queue) return { finished: true };

    const nextIndex = queue.currentIndex + 1;

    if (nextIndex < queue.segments.length) {
      // 还有更多段落
      speechQueue.value = {
        ...queue,
        currentIndex: nextIndex,
        awaitingNextSegment: false,
      };
      currentDialogue.value = {
        speaker: queue.player.displayName,
        text: queue.segments[nextIndex]!,
        isStreaming: true,
      };
      return { finished: false };
    } else if (queue.isStreaming && !queue.isFinalized) {
      // 流式未完成，等待更多段落
      queue.awaitingNextSegment = true;
      return { finished: false, waiting: true } as unknown as {
        finished: boolean;
        afterSpeech?: () => void;
      };
    } else {
      // 所有段落已完成
      speechQueue.value = null;
      currentDialogue.value = null;
      return { finished: true };
    }
  }

  /** 清除发言队列 */
  function clearSpeechQueue() {
    speechQueue.value = null;
    currentDialogue.value = null;
  }

  /** 设置预加载发言缓存 */
  function setPrefetchedSpeech(prefetch: PrefetchedSpeech | null) {
    prefetchedSpeech.value = prefetch;
  }

  /**
   * 消费预加载发言缓存
   */
  function consumePrefetchedSpeech(criteria: PrefetchCriteria): string[] | null {
    const prefetch = prefetchedSpeech.value;
    if (!prefetch) return null;

    const matches =
      prefetch.playerId === criteria.playerId &&
      prefetch.phase === criteria.phase &&
      prefetch.day === criteria.day &&
      criteria.messageCount >= prefetch.messageCount;

    if (!matches) {
      prefetchedSpeech.value = null;
      return null;
    }

    if (!prefetch.isComplete || prefetch.segments.length === 0) {
      return null;
    }

    prefetchedSpeech.value = null;
    return prefetch.segments;
  }

  /** 重置所有对话状态 */
  function resetDialogueState() {
    currentDialogue.value = null;
    isWaitingForAI.value = false;
    waitingForNextRound.value = false;
    speechQueue.value = null;
    prefetchedSpeech.value = null;
  }

  return {
    // State
    currentDialogue,
    isWaitingForAI,
    waitingForNextRound,

    // Setters
    setIsWaitingForAI: (v: boolean) => {
      isWaitingForAI.value = v;
    },
    setWaitingForNextRound: (v: boolean) => {
      waitingForNextRound.value = v;
    },

    // Actions
    setDialogue,
    clearDialogue,
    initSpeechQueue,
    initStreamingSpeechQueue,
    appendToSpeechQueue,
    finalizeSpeechQueue,
    advanceSpeechQueue,
    clearSpeechQueue,
    resetDialogueState,
    setPrefetchedSpeech,
    consumePrefetchedSpeech,
    markCurrentSegmentCompleted,
    isCurrentSegmentCompleted,
  };
}
