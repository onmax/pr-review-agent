import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, CONTEXT_GATHERING, OUTPUT_THRESHOLD, PARALLEL_TOOLS } from './types'

export const apiReviewer: AgentDefinition = {
  description: 'API routes - h3 helpers, validation, error handling.',
  alwaysSpawn: false,
  skills: ['nuxt', 'nuxt-modules', 'ts-library'],
  triggers: ['server/api/**', 'server/routes/**', 'routes/**'],
  prompt: `<task>Review API route implementation.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. h3 v1 helpers - readBody, getQuery, getRouterParam with validation
2. Input validation - zod schemas, type safety
3. Error handling - createError, proper status codes
4. Response format - consistent structure
5. Authentication - middleware usage
6. Rate limiting considerations
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[API] Issue title
File: path:line
Issue: specific problem
Suggestion: h3 best practice
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
  model: 'sonnet',
}
