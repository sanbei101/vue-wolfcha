import { defineStore } from "pinia";

export type DifficultyLevel = "easy" | "normal" | "hard";

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    playerName: "",
    playerCount: 8,
    difficulty: "normal" as DifficultyLevel,
    autoPlay: false,
    speechSpeed: "normal" as "slow" | "normal" | "fast",
  }),

  actions: {
    setPlayerName(name: string) {
      this.playerName = name;
    },

    setPlayerCount(count: number) {
      this.playerCount = Math.min(10, Math.max(6, count));
    },

    setDifficulty(difficulty: DifficultyLevel) {
      this.difficulty = difficulty;
    },

    toggleAutoPlay() {
      this.autoPlay = !this.autoPlay;
    },
  },
});
