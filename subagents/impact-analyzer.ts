import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, PARALLEL_TOOLS } from './types'

export const impactAnalyzer: AgentDefinition = {
  description: 'Cross-file impact analysis.',
  alwaysSpawn: false,
  skills: [],
  triggers: [],
  prompt: `<task>Analyze cross-file dependencies and impact.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}

<analysis>
1. Find all imports of modified files
2. Identify callers of changed functions
3. Check for type dependencies
4. Map the blast radius of changes
</analysis>

<output_format>
## Impact Analysis

### Files Affected
- path: description of impact

### Dependency Chain
[Visualization of dependencies]

### Risk Areas
[Parts of codebase that might be affected]
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
  model: 'sonnet',
}
