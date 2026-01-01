import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, OUTPUT_THRESHOLD, PARALLEL_TOOLS } from './types'

export const typescriptReviewer: AgentDefinition = {
  description: 'TypeScript - complex types, generics, type safety.',
  alwaysSpawn: false,
  skills: ['ts-library'],
  triggers: ['*.ts', '*.tsx', '!*.d.ts'],
  prompt: `<task>Review TypeScript patterns and type safety.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}

Use ts-library skill for advanced patterns.

<checks>
1. Type safety - avoid any, unknown when possible
2. Generics - proper constraints, inference
3. Utility types - Pick, Omit, Partial usage
4. Type narrowing - proper guards
5. Declaration files - accurate exports
6. Inference - let TypeScript infer when clear
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[TS] Issue title
File: path:line
Issue: type safety problem
Suggestion: better typing
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'sonnet',
}
