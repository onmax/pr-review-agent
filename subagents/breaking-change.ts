import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, OUTPUT_THRESHOLD } from './types'

export const breakingChange: AgentDefinition = {
  description: 'Breaking changes - public API, exports.',
  alwaysSpawn: false,
  skills: [],
  triggers: [],
  prompt: `<task>Identify breaking changes.</task>

${CODE_EXPLORATION}

<checks>
1. Export changes - removed, renamed
2. Function signatures - parameter changes
3. Type changes - stricter or different types
4. Behavior changes - different return values
5. Default value changes
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[BREAKING] Change description
File: path:line
Before: previous behavior/signature
After: new behavior/signature
Migration: how to update consumers
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
  model: 'sonnet',
}
