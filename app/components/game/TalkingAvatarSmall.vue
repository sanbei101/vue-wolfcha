<script setup lang="ts">
/**
 * TalkingAvatarSmall.vue
 *
 * 小头像版本,用于聊天历史中的玩家头像。
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
    class?: string;
    alt?: string;
  }>(),
  {
    isTalking: false,
    class: "w-8 h-8 rounded-full",
    alt: "Avatar",
  }
);

const TALKING_LIPS = getTalkingLips();
const lipIndex = ref(0);
let intervalRef: ReturnType<typeof setInterval> | null = null;

const IDLE_LIPS = computed(() => getIdleLipsForSeed(props.seed));
const currentLips = ref(getIdleLipsForSeed(props.seed));

// 预加载
const preloadUrls = computed(() => {
  const urls: string[] = [];
  urls.push(buildAvatarUrl({ seed: props.seed, gender: props.gender, lips: IDLE_LIPS.value, backgroundColor: "transparent" }));
  for (const lips of TALKING_LIPS) {
    urls.push(buildAvatarUrl({ seed: props.seed, gender: props.gender, lips, backgroundColor: "transparent" }));
  }
  return urls;
});

preloadUrls.value.forEach((url) => {
  const img = new Image();
  img.src = url;
});

const currentUrl = computed(() =>
  buildAvatarUrl({ seed: props.seed, gender: props.gender, lips: currentLips.value, backgroundColor: "transparent" })
);

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
  <img :src="currentUrl" :alt="alt" :class="props.class" />
</template>
