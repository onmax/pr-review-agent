import type { AgentDefinition } from './types'
import { OUTPUT_THRESHOLD } from './types'

export const depsReviewer: AgentDefinition = {
  description: 'Dependency changes - package.json, lockfile updates.',
  alwaysSpawn: false,
  skills: [],
  triggers: ['package.json', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'],
  prompt: `<task>Review dependency changes.</task>

<checks>
1. New dependencies - necessity, bundle size, maintenance status
2. Version bumps - breaking changes, changelog review
3. Security - known vulnerabilities (check npm audit if possible)
4. Duplicate dependencies
5. Dev vs prod placement
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[DEPS] Issue title
Package: name@version
Issue: concern about the dependency
Suggestion: alternative or action
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Bash', 'Grep'],
  model: 'haiku',
}
