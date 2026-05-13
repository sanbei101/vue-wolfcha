/**
 * Typewriter Effect Composable
 *
 * 逐字显示文本动画，支持：
 * - 3字符/次批量渲染（兼顾中英文速度）
 * - 标点符号智能停顿（句号1.8x，逗号1.2x，感叹疑问1.3x）
 * - 中途跳过完整显示
 * - 自动完成回调
 */

import { ref, watch, onUnmounted } from "vue";

const CHUNK_SIZE = 3; // 每帧渲染字符数
const SPEED_MULTIPLIER = 0.7; // 整体加速系数

interface UseTypewriterOptions {
  text?: string;
  speed?: number; // 每字符基础延迟(ms)
  enabled?: boolean;
  onComplete?: () => void;
}

export function useTypewriter(options: UseTypewriterOptions = {}) {
  const { speed = 30, enabled = true, onComplete } = options;

  const displayedText = ref("");
  const isTyping = ref(false);
  const completedText = ref<string | null>(null);
  const currentText = ref(options.text ?? "");

  let indexRef = 0;
  let timeoutRef: ReturnType<typeof setTimeout> | null = null;

  // 跳过打字，直接显示完整文本
  function skip() {
    if (timeoutRef) {
      clearTimeout(timeoutRef);
      timeoutRef = null;
    }
    if (currentText.value) {
      displayedText.value = currentText.value;
      isTyping.value = false;
      completedText.value = currentText.value;
      onComplete?.();
    }
  }

  function typeNextChunk() {
    if (indexRef >= currentText.value.length) {
      isTyping.value = false;
      completedText.value = currentText.value;
      onComplete?.();
      return;
    }

    const advance = Math.min(CHUNK_SIZE, currentText.value.length - indexRef);
    indexRef += advance;
    displayedText.value = currentText.value.slice(0, indexRef);

    // 标点停顿：中文句号/逗号和英文句号/逗号
    let delay = speed * advance * SPEED_MULTIPLIER;
    const lastChar = currentText.value[indexRef - 1];
    if (!lastChar) {
      // no-op
    } else if (lastChar === "。" || lastChar === ".") {
      delay *= 1.8;
    } else if (lastChar === "，" || lastChar === ",") {
      delay *= 1.2;
    } else if ("！？".includes(lastChar) || "!?".includes(lastChar)) {
      delay *= 1.3;
    } else if (lastChar === " ") {
      delay *= 0.9;
    }

    timeoutRef = setTimeout(typeNextChunk, Math.round(delay));
  }

  function start(text: string) {
    if (timeoutRef) {
      clearTimeout(timeoutRef);
      timeoutRef = null;
    }

    currentText.value = text;
    indexRef = 0;
    displayedText.value = "";
    isTyping.value = true;
    completedText.value = null;

    timeoutRef = setTimeout(typeNextChunk, Math.round(speed * SPEED_MULTIPLIER));
  }

  function reset() {
    if (timeoutRef) {
      clearTimeout(timeoutRef);
      timeoutRef = null;
    }
    indexRef = 0;
    displayedText.value = "";
    isTyping.value = false;
    completedText.value = null;
    currentText.value = "";
  }

  // 外部设置文本时自动启动
  watch(
    () => options.text,
    (newText) => {
      if (newText !== undefined && newText !== currentText.value) {
        start(newText);
      }
    },
  );

  onUnmounted(() => reset());

  return {
    displayedText,
    isTyping,
    completedText,
    start,
    skip,
    reset,
  };
}
