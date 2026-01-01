import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, CONTEXT_GATHERING, OUTPUT_THRESHOLD, PARALLEL_TOOLS } from './types'

export const codeQuality: AgentDefinition = {
  description: 'Code quality - readability, DRY, complexity, CLAUDE.md compliance.',
  alwaysSpawn: true,
  skills: [],
  triggers: [],
  prompt: `<task>Review code quality and CLAUDE.md compliance.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. CLAUDE.md compliance - verify specific guideline violations, quote the guideline
2. Readability - naming conventions, clarity
3. DRY violations - copy-pasted code blocks
4. Complexity - deep nesting (>3 levels), long functions (>50 lines)
5. Error handling patterns
6. Consistency with existing codebase style
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[QUALITY] Issue title
File: path:line
Issue: specific problem
Guideline: "CLAUDE.md says..." (if applicable)
Suggestion: minimal fix
Confidence: 0-100
</output_format>

Focus on actionable issues. Skip nitpicks and style preferences not in CLAUDE.md.`,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'sonnet',
}
