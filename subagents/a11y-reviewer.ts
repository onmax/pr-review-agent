import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, OUTPUT_THRESHOLD, PARALLEL_TOOLS } from './types'

export const a11yReviewer: AgentDefinition = {
  description: 'Accessibility - ARIA, semantic HTML, keyboard navigation.',
  alwaysSpawn: false,
  skills: ['vue', 'reka-ui'],
  triggers: ['*.vue', 'components/**'],
  prompt: `<task>Review accessibility patterns.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}

Use reka-ui skill for headless component patterns.

<checks>
1. Semantic HTML - proper heading hierarchy, landmarks
2. ARIA attributes - roles, labels, descriptions
3. Keyboard navigation - focus management, tab order
4. Screen reader - alt text, announcements
5. Color contrast considerations
6. Reka UI - proper composition patterns
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[A11Y] Issue title
File: path:line
Issue: accessibility problem
WCAG: guideline reference
Suggestion: accessible implementation
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'sonnet',
}
