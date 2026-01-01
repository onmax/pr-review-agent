import { z } from 'zod'

const runtimeConfigSchema = z.object({
  githubWebhookSecret: z.string().min(1, 'NUXT_GITHUB_WEBHOOK_SECRET is required'),
  githubAppId: z.union([z.string(), z.number()]).optional(),
  githubAppPrivateKey: z.string().optional(),
  githubToken: z.string().optional(),
  modelProvider: z.string().optional(),
  defaultModel: z.string().optional(),
  securityModel: z.string().optional(),
  analysisModel: z.string().optional(),
  utilityModel: z.string().optional(),
}).passthrough()

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  modules: ['nuxt-safe-runtime-config'],

  // Webhook-only server - no frontend
  ssr: false,
  pages: false,
  components: false,

  runtimeConfig: {
    githubWebhookSecret: '',
    githubAppId: '',
    githubAppPrivateKey: '',
    githubToken: '',
    modelProvider: 'claude',
    defaultModel: 'sonnet',
    securityModel: 'opus',
    analysisModel: 'sonnet',
    utilityModel: 'haiku',
  },

  safeRuntimeConfig: {
    $schema: runtimeConfigSchema,
    validateAtBuild: false,
    validateAtRuntime: true,
  },

  nitro: {
    preset: 'node-server',
  },

  typescript: {
    strict: true,
  },
})
