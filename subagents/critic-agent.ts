import type { AgentDefinition } from './types'

export const criticAgent: AgentDefinition = {
  description: 'Meta-reviewer - validates other agents findings before posting.',
  alwaysSpawn: false,
  skills: [],
  triggers: [],
  prompt: `<task>Review and validate aggregated findings before posting.</task>

<checks>
For each finding:
1. Evidence cited? - must have file:line reference
2. Actionable? - must have clear fix suggestion
3. Verified? - finding based on actual code inspection
4. Not a nitpick? - has real impact
5. Not duplicate? - not reported by another agent
</checks>

<actions>
- KEEP: findings that pass all checks
- REMOVE: duplicates, nitpicks, unverified claims
- IMPROVE: add missing line numbers or clarify vague suggestions
</actions>

<output_format>
Return cleaned findings list with duplicates removed and quality improved.
</output_format>`,
  tools: ['Read'],
  model: 'haiku',
}
