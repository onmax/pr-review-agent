export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  modules: [],

  // Webhook-only server - no frontend
  ssr: false,
  pages: false,
  components: false,

  runtimeConfig: {
    githubAppId: '',
    githubAppPrivateKey: '',
    githubToken: '',
    modelProvider: 'claude',
    defaultModel: 'sonnet',
    securityModel: 'opus',
    analysisModel: 'sonnet',
    utilityModel: 'haiku',
  },

  nitro: {
    preset: 'node-server',
  },

  typescript: {
    strict: true,
  },
})
