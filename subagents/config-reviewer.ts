import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, OUTPUT_THRESHOLD } from './types'

export const configReviewer: AgentDefinition = {
  description: 'Configuration files - nuxt.config, tsconfig, env.',
  alwaysSpawn: false,
  skills: ['nuxt'],
  triggers: ['*.config.ts', '*.config.js', 'tsconfig.json', '.env*', '!.env.example'],
  prompt: `<task>Review configuration changes.</task>

${CODE_EXPLORATION}

<checks>
1. Security - no secrets in config (should be in env)
2. Correctness - valid options, no deprecated settings
3. Compatibility - Node version, browser targets
4. Performance - build optimization settings
5. Environment handling - proper .env usage
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[CONFIG] Issue title
File: path
Issue: configuration problem
Suggestion: correct setting
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Glob', 'Grep'],
  model: 'haiku',
}
