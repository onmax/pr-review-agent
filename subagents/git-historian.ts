import type { AgentDefinition } from './types'

export const gitHistorian: AgentDefinition = {
  description: 'Git history - blame, related PRs, patterns.',
  alwaysSpawn: false,
  skills: [],
  triggers: [],
  prompt: `<task>Gather git history context.</task>

<investigation>
1. Run git blame on modified files - identify recent authors
2. Search related commits from last 30 days
3. Extract issue/PR references from commit messages
4. Identify patterns in the codebase
</investigation>

<output_format>
## Historical Context
- Recent authors: [names]
- Related commits: [refs with summaries]
- Linked issues/PRs: [#refs]

## Patterns Observed
[Codebase conventions from history]
</output_format>`,
  tools: ['Bash', 'Read', 'Grep'],
  model: 'haiku',
}
