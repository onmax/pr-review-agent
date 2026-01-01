import type { AgentDefinition } from './types'
import { OUTPUT_THRESHOLD } from './types'

export const docChecker: AgentDefinition = {
  description: 'Documentation - README, CHANGELOG, JSDoc.',
  alwaysSpawn: false,
  skills: [],
  triggers: ['README*', 'CHANGELOG*', 'docs/**', '*.md'],
  prompt: `<task>Quick documentation review.</task>

<checks>
1. README updates - new features documented
2. CHANGELOG - breaking changes noted
3. JSDoc - exported functions documented
4. Code comments - complex logic explained
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[DOCS] Issue title
File: path
Gap: what's missing
Suggestion: what to add
Confidence: 0-100
</output_format>

Quick pass only. Do not over-report minor gaps.`,
  tools: ['Read', 'Glob'],
  model: 'haiku',
}
