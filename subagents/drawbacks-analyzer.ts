import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, CONTEXT_GATHERING, OUTPUT_THRESHOLD, PARALLEL_TOOLS } from './types'

export const drawbacksAnalyzer: AgentDefinition = {
  description: 'Edge cases, risks, potential regressions.',
  alwaysSpawn: false,
  skills: [],
  triggers: [],
  prompt: `<task>Adversarial analysis of what could go wrong.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<analysis>
Evaluate adversarially - consider failure modes:
1. Edge cases - empty, null, unicode, boundaries, negative
2. Regression risks - changes that could break existing behavior
3. Compatibility - browser, Node version, dependencies
4. Scale issues - behavior with 1000x data
5. Failure modes - network, timeouts, partial failures
</analysis>

<output_format>
${OUTPUT_THRESHOLD}

[RISK] Issue title
File: path:line
Scenario: specific trigger condition
Impact: what breaks
Mitigation: minimal fix
Confidence: 0-100
</output_format>

Be selective. Only report risks likely to occur in production.`,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
  model: 'sonnet',
}
