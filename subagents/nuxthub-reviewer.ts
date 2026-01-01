import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, CONTEXT_GATHERING, OUTPUT_THRESHOLD, PARALLEL_TOOLS } from './types'

export const nuxthubReviewer: AgentDefinition = {
  description: 'NuxtHub patterns - database, KV, blob storage.',
  alwaysSpawn: false,
  skills: ['nuxthub', 'nuxt'],
  triggers: ['**/hub/**', '**/*hub*', '**/useKV*', '**/useBlob*', '**/useDrizzle*', 'drizzle/**'],
  prompt: `<task>Review NuxtHub v0.10+ patterns.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

Use the nuxthub skill for latest patterns.

<checks>
1. Database - Drizzle ORM, proper schema, migrations
2. KV storage - proper key patterns, TTL usage
3. Blob storage - file handling, content types
4. Cache API usage
5. Multi-cloud deployment considerations
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[NUXTHUB] Issue title
File: path:line
Issue: specific problem
Suggestion: NuxtHub best practice
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
  model: 'sonnet',
}
