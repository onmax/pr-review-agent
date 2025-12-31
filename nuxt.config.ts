export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // Webhook-only server - no frontend
  ssr: false,
  pages: false,
  components: false,

  runtimeConfig: {
    // Webhook secret (required)
    githubWebhookSecret: '',

    // GitHub App auth (primary)
    githubAppId: '',
    githubAppPrivateKey: '',

    // PAT fallback (for external repos or local dev)
    githubToken: '',

    // Model configuration (for future provider flexibility)
    modelProvider: 'claude', // claude | openai | local
    defaultModel: 'sonnet',

    // Agent model overrides
    securityModel: 'opus', // strongest for security
    analysisModel: 'sonnet', // balanced for analysis
    utilityModel: 'haiku', // fast for utility tasks
  },

  nitro: {
    preset: 'node-server',
  },

  typescript: {
    strict: true,
  },
})
