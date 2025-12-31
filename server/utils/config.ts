import { z } from 'zod'

// Runtime config schema with validation
const RuntimeConfigSchema = z.object({
  githubWebhookSecret: z.string().min(1, 'GITHUB_WEBHOOK_SECRET is required'),
  githubToken: z.string().min(1, 'GITHUB_TOKEN is required'),

  // Access control
  allowedUsers: z.string().transform(s => s.split(',').map(u => u.trim()).filter(Boolean)).default(''),
  allowedRepos: z.string().transform(s => s.split(',').map(r => r.trim()).filter(Boolean)).default(''),

  // Model configuration
  modelProvider: z.enum(['claude', 'openai', 'local']).default('claude'),
  defaultModel: z.string().default('sonnet'),
  securityModel: z.string().optional(),
  analysisModel: z.string().optional(),
  utilityModel: z.string().optional(),
})

export type AppRuntimeConfig = z.infer<typeof RuntimeConfigSchema>

let validatedConfig: AppRuntimeConfig | null = null

export function getValidatedConfig(): AppRuntimeConfig {
  if (validatedConfig) return validatedConfig

  const config = useRuntimeConfig()

  const result = RuntimeConfigSchema.safeParse({
    githubWebhookSecret: config.githubWebhookSecret,
    githubToken: config.githubToken,
    allowedUsers: config.allowedUsers,
    allowedRepos: config.allowedRepos,
    modelProvider: config.modelProvider,
    defaultModel: config.defaultModel,
    securityModel: config.securityModel,
    analysisModel: config.analysisModel,
    utilityModel: config.utilityModel,
  })

  if (!result.success) {
    const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
    throw new Error(`Invalid runtime config: ${errors}`)
  }

  validatedConfig = result.data
  return validatedConfig
}

// Helper to get model for a specific agent type
export function getModelForAgent(agentType: 'security' | 'analysis' | 'utility'): string {
  const config = getValidatedConfig()

  switch (agentType) {
    case 'security':
      return config.securityModel ?? 'opus'
    case 'analysis':
      return config.analysisModel ?? 'sonnet'
    case 'utility':
      return config.utilityModel ?? 'haiku'
  }
}
