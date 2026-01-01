import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, CONTEXT_GATHERING, OUTPUT_THRESHOLD, PARALLEL_TOOLS } from './types'

export const perfReviewer: AgentDefinition = {
  description: 'Performance - N+1, memory, bundle size, render.',
  alwaysSpawn: false,
  skills: [],
  triggers: [],
  prompt: `<task>Analyze performance implications.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. N+1 queries - DB/API calls inside loops, missing batching
2. Memory leaks - event listeners without cleanup, growing collections
3. Bundle impact - heavy imports (lodash, moment), missing tree-shaking
4. Render performance - React/Vue anti-patterns (inline objects, missing keys)
5. Async patterns - sequential awaits that could parallelize
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[PERF] Issue title
File: path:line
Pattern: what code does
Issue: specific problem
Impact: estimated effect (e.g., "O(n²) in loop with avg 100 items")
Fix: minimal solution
Confidence: 0-100
</output_format>

Focus on measurable impact. Skip micro-optimizations.`,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'sonnet',
}
