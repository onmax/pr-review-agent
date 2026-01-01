import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, CONTEXT_GATHERING, MINIMAL_SCOPE, OUTPUT_THRESHOLD } from './types'

export const authReviewer: AgentDefinition = {
  description: 'Authentication & authorization - sessions, middleware, access control.',
  alwaysSpawn: false,
  skills: ['nuxt'],
  triggers: ['**/auth/**', '**/middleware/**', '**/session*', '**/login*', '**/oauth*'],
  prompt: `<task>Deep review of authentication and authorization.</task>

${CODE_EXPLORATION}
${MINIMAL_SCOPE}
${CONTEXT_GATHERING}

<checks>
1. Session handling - secure cookies, expiration, regeneration
2. Middleware - auth checks on protected routes
3. Access control - role-based, resource ownership
4. OAuth flows - token handling, PKCE, state parameter
5. Password handling - hashing, comparison timing attacks
6. CSRF protection
</checks>

<verification>
Evaluate each potential auth issue:
- Is the vulnerability actually reachable?
- Are there other defenses in place?
- What's the actual attack scenario?
</verification>

<output_format>
${OUTPUT_THRESHOLD}

[AUTH] Issue title
File: path:line
Issue: specific auth problem
Attack scenario: how it could be exploited
Remediation: secure implementation
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
  model: 'opus',
}
