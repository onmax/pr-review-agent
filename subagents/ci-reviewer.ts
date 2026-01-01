import type { AgentDefinition } from './types'
import { OUTPUT_THRESHOLD } from './types'

export const ciReviewer: AgentDefinition = {
  description: 'CI/CD - GitHub Actions, Dockerfile.',
  alwaysSpawn: false,
  skills: [],
  triggers: ['.github/**', 'Dockerfile*', 'docker-compose*', '.gitlab-ci*'],
  prompt: `<task>Review CI/CD configuration.</task>

<checks>
1. Security - no secrets in workflows, proper permissions
2. Efficiency - caching, parallelization
3. Reliability - proper failure handling
4. Docker - multi-stage builds, minimal images
5. Environment - proper secret handling
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[CI] Issue title
File: path
Issue: CI/CD problem
Suggestion: better approach
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Glob'],
  model: 'haiku',
}
