import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, CONTEXT_GATHERING, OUTPUT_THRESHOLD, PARALLEL_TOOLS } from './types'

export const nuxtReviewer: AgentDefinition = {
  description: 'Nuxt 4+ patterns - server routes, composables, runtimeConfig, h3.',
  alwaysSpawn: false,
  skills: ['nuxt', 'nuxt-modules'],
  triggers: ['nuxt.config.*', 'server/**', 'app/**', 'composables/**', 'plugins/**', 'middleware/**'],
  prompt: `<task>Review Nuxt 4+ patterns and best practices.</task>

<skills>
FIRST, invoke the Skill tool to load guidance:
- Skill tool with skill: "nuxt" for Nuxt 4 patterns
- Skill tool with skill: "nuxt-modules" if reviewing modules
</skills>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. Server routes - proper h3 v1 helpers, validation with zod, error handling
2. Composables - proper use, reactivity patterns, SSR safety
3. runtimeConfig - secrets in private, public for client-side
4. Middleware - auth patterns, redirect handling
5. Plugins - proper initialization, provide/inject
6. Auto-imports - verify imports resolve correctly
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[NUXT] Issue title
File: path:line
Pattern: what should be used
Issue: what's wrong
Suggestion: correct approach
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
  model: 'sonnet',
}
