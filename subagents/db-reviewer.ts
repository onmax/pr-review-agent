import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, CONTEXT_GATHERING, OUTPUT_THRESHOLD, PARALLEL_TOOLS } from './types'

export const dbReviewer: AgentDefinition = {
  description: 'Database patterns - schema, migrations, queries, Drizzle ORM.',
  alwaysSpawn: false,
  skills: ['nuxthub'],
  triggers: ['**/schema/**', '**/drizzle/**', '**/migrations/**', '**/*.schema.ts', '**/db/**'],
  prompt: `<task>Review database schema and query patterns.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. Schema design - normalization, indexes, constraints
2. Migrations - reversibility, data safety
3. Query patterns - N+1, missing indexes, SQL injection risk
4. Drizzle ORM - proper usage, type safety
5. Transaction handling - atomicity, error rollback
6. Connection management
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[DB] Issue title
File: path:line
Issue: schema/query problem
Impact: performance or data integrity concern
Suggestion: correct approach
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
  model: 'sonnet',
}
