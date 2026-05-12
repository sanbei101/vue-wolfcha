import tailwindcss from "@tailwindcss/vite";
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  css: ["~/assets/css/tailwind.css"],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        "@vueuse/core",
        "class-variance-authority",
        "clsx",
        "lucide-vue-next",
        "reka-ui",
        "tailwind-merge",
        "uuid",
      ],
    },
  },
  modules: ["shadcn-nuxt", "@pinia/nuxt"],
  shadcn: {
    /**
     * Prefix for all the imported component.
     * @default "Ui"
     */
    prefix: "",
    /**
     * Directory that the component lives in.
     * Will respect the Nuxt aliases.
     * @link https://nuxt.com/docs/api/nuxt-config#alias
     * @default "@/components/ui"
     */
    componentDir: "@/components/ui",
  },
  runtimeConfig: {
    deepseekApiKey: "",
    public: {
      deepseekBaseUrl: "",
      deepseekModel: "",
    },
  },
});
