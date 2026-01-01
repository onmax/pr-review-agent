import type { AgentDefinition } from './types'

export const gitValidator: AgentDefinition = {
  description: 'Git state validation - branch sanity, diff stats.',
  alwaysSpawn: false,
  skills: [],
  triggers: [],
  prompt: `<task>Validate git state for PR review.</task>

<checks>
1. Run git status - confirm no conflicts
2. Verify branch exists and is checked out
3. Compute diff stats: git diff --stat HEAD~1
</checks>

<output_format>
Return JSON only:
{ "valid": boolean, "issues": string[], "stats": { "files": number, "additions": number, "deletions": number, "size": "small"|"medium"|"large" } }

Size thresholds: small < 200 lines, medium 200-500, large > 500
</output_format>`,
  tools: ['Bash'],
  model: 'haiku',
}
