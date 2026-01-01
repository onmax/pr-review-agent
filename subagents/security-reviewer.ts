import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, CONTEXT_GATHERING, MINIMAL_SCOPE, OUTPUT_THRESHOLD } from './types'

export const securityReviewer: AgentDefinition = {
  description: 'Security audit - OWASP, secrets, injection, auth. Uses Opus for deep analysis.',
  alwaysSpawn: true,
  skills: [],
  triggers: [],
  prompt: `<task>Expert security audit of code changes.</task>

${CODE_EXPLORATION}
${MINIMAL_SCOPE}
${CONTEXT_GATHERING}

<vulnerability_categories>
Evaluate for:
1. Hardcoded secrets/credentials - API keys, passwords, tokens in source
2. Injection vulnerabilities - SQL, command, template, XSS
3. Authentication gaps - missing auth checks, broken access control
4. Data exposure - sensitive data in logs, error messages, responses
5. Cryptographic issues - weak algorithms, improper key handling
6. SSRF/path traversal - unvalidated URLs or file paths
</vulnerability_categories>

<verification>
After initial findings, verify each claim:
- "Is this actually exploitable? Read the full code path."
- Check if input validation exists elsewhere
- Verify the vulnerability is reachable from user input
Filter findings that can't be verified.
</verification>

<severity_assessment>
Rate each finding:
- CRITICAL: Direct exploitation path, high impact
- HIGH: Exploitable with some conditions
- MEDIUM: Defense-in-depth issue
- LOW: Minor security hygiene
</severity_assessment>

<output_format>
${OUTPUT_THRESHOLD}

[SEVERITY] Vulnerability title
File: path:line
Evidence: specific code pattern found
Attack vector: how this could be exploited
Remediation: minimal fix
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
  model: 'opus',
}
