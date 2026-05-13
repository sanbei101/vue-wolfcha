<script setup lang="ts">
/**
 * TalkingAvatar.vue
 *
 * 带说话动画的头像组件:
 * - 静止时显示 getIdleLipsForSeed(seed) 的嘴型
 * - 说话时每 120ms 在 TALKING_LIPS 之间切换嘴型
 * - 通过 DiceBear Notionists API 动态生成头像
 */

import { ref, computed, watch, onUnmounted } from "vue";
import {
  buildAvatarUrl,
  getIdleLipsForSeed,
  getTalkingLips,
  type AvatarGender,
} from "~/lib/avatar-config";

const props = withDefaults(
  defineProps<{
    seed: string;
    gender?: AvatarGender;
    isTalking?: boolean;
    scale?: number;
    translateY?: number;
    class?: string;
    alt?: string;
  }>(),
  {
    isTalking: false,
    scale: 120,
    translateY: -5,
    class: "w-[220px] lg:w-[260px] xl:w-[300px] h-auto object-contain",
    alt: "Avatar",
  }
);

const TALKING_LIPS = getTalkingLips();
const lipIndex = ref(0);
let intervalRef: ReturnType<typeof setInterval> | null = null;

const IDLE_LIPS = computed(() => getIdleLipsForSeed(props.seed));
const currentLips = ref(getIdleLipsForSeed(props.seed));

// 预加载 URL
const preloadUrls = computed(() => {
  const urls: string[] = [];
  urls.push(
    buildAvatarUrl({
      seed: props.seed,
      gender: props.gender,
      lips: IDLE_LIPS.value,
      scale: props.scale,
      translateY: props.translateY,
      backgroundColor: "transparent",
    })
  );
  for (const lips of TALKING_LIPS) {
    urls.push(
      buildAvatarUrl({
        seed: props.seed,
        gender: props.gender,
        lips,
        scale: props.scale,
        translateY: props.translateY,
        backgroundColor: "transparent",
      })
    );
  }
  return urls;
});

// 静默预加载
preloadUrls.value.forEach((url) => {
  const img = new Image();
  img.src = url;
});

const currentUrl = computed(() =>
  buildAvatarUrl({
    seed: props.seed,
    gender: props.gender,
    lips: currentLips.value,
    scale: props.scale,
    translateY: props.translateY,
    backgroundColor: "transparent",
  })
);

// 说话动画
watch(
  () => props.isTalking,
  (talking) => {
    if (talking) {
      lipIndex.value = 0;
      currentLips.value = TALKING_LIPS[0]!;
      intervalRef = setInterval(() => {
        lipIndex.value = (lipIndex.value + 1) % TALKING_LIPS.length;
        currentLips.value = TALKING_LIPS[lipIndex.value]!;
      }, 120);
    } else {
      if (intervalRef) {
        clearInterval(intervalRef);
        intervalRef = null;
      }
      currentLips.value = IDLE_LIPS.value;
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
});
</script>

<template>
  <!-- 预加载隐藏图片 -->
  <div class="hidden" aria-hidden="true">
    <img v-for="url in preloadUrls" :key="url" :src="url" alt="" />
  </div>

  <!-- 实际显示的头像 -->
  <img :src="currentUrl" :alt="alt" :class="props.class" />
</template>
