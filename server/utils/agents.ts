import { getModelForAgent } from './config'

// Agent definition type for Claude Code SDK
export interface AgentDefinition {
  description: string
  prompt: string
  tools?: string[]
  model?: 'haiku' | 'sonnet' | 'opus'
}

/**
 * Agent definitions optimized per Anthropic's Claude 4.x prompt engineering best practices.
 * - Haiku (utility): Fast, direct prompts. No extended thinking. Max 8000 tokens.
 * - Sonnet (analysis): Balanced. Explicit parallel tool calling. Multi-file context.
 * - Opus (security): Deep reasoning. Avoid "think" → use "evaluate/consider/assess".
 *   Explicit code exploration instructions. Minimal solution guidance.
 */
export function getReviewAgents(): Record<string, AgentDefinition> {
  const securityModel = getModelForAgent('security')
  const analysisModel = getModelForAgent('analysis')
  const utilityModel = getModelForAgent('utility')

  return {
    // UTILITY TIER (Haiku) - Fast, direct, simple tasks
    'git-validator': {
      description: 'Validates git state and PR branch sanity before review. Use first.',
      prompt: `<task>Validate git state for PR review.</task>

<checks>
1. Run git status - confirm no conflicts or dirty state
2. Verify branch exists and is checked out
3. Compute diff stats: git diff --stat HEAD~1
</checks>

<output_format>
Return JSON only:
{ "valid": boolean, "issues": string[], "stats": { "files": number, "additions": number, "deletions": number, "size": "small"|"medium"|"large" } }

Size thresholds: small < 200 lines, medium 200-500, large > 500
</output_format>

Execute checks now and return the JSON result.`,
      tools: ['Bash'],
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'documentation': {
      description: 'Documentation gaps - JSDoc, README updates.',
      prompt: `<task>Quick documentation scan for gaps.</task>

<checks>
1. Exported functions/classes missing JSDoc
2. README needs update for new features
3. Complex code lacking explanatory comments
4. Breaking changes need CHANGELOG entry
</checks>

<output_format>
Only report issues with confidence >= 80:

[DOCS] Issue title
File: path:line
Function/area: name
Gap: what's missing
Suggestion: specific fix
Confidence: 0-100
</output_format>

Quick pass only. Do not over-report minor gaps.`,
      tools: ['Read', 'Glob'],
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'github-api': {
      description: 'Posts review results via GitHub REST API.',
      prompt: `<task>Post PR review comment via GitHub REST API.</task>

<environment>
Use these env vars:
- GITHUB_TOKEN: Bearer token for auth
- PR_OWNER: Repository owner
- PR_REPO: Repository name
- PR_NUMBER: Pull request number
</environment>

<api_call>
curl -s -X POST -H "Authorization: Bearer $GITHUB_TOKEN" \\
  -H "Accept: application/vnd.github.v3+json" \\
  "https://api.github.com/repos/$PR_OWNER/$PR_REPO/issues/$PR_NUMBER/comments" \\
  -d '{"body": "COMMENT_BODY"}'
</api_call>

<link_format>
Always use full SHA in code links:
https://github.com/OWNER/REPO/blob/FULL_SHA/path#L10-L15
</link_format>

<suggestion_syntax>
For inline code suggestions use:
\`\`\`suggestion
fixed code here
\`\`\`
</suggestion_syntax>

Execute the API call with the provided review content.`,
      tools: ['Bash'],
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    // ANALYSIS TIER (Sonnet) - Multi-file context, parallel tools
    'context-explorer': {
      description: 'Git blame and historical context for small PRs (< 500 lines). Skip for large PRs.',
      prompt: `<task>Gather git history context for small PRs.</task>

<parallel_tool_calls>
Call multiple tools simultaneously for efficiency:
- Read multiple files in parallel
- Run independent git commands in parallel
</parallel_tool_calls>

<investigation>
1. Run git blame on modified files - identify recent authors and change patterns
2. Search related commits from last 30 days: git log --oneline --since="30 days ago"
3. Extract issue/PR references from commit messages (#123 patterns)
4. Locate CLAUDE.md files in root and modified directories
</investigation>

<output_format>
Return structured context summary:

## Historical Context
- Recent authors: [names]
- Related commits: [refs with summaries]
- Linked issues/PRs: [#refs]

## CLAUDE.md Guidelines
[Relevant guidelines if found]

## Patterns Observed
[Codebase conventions from history]
</output_format>

Skip entirely if PR > 500 lines changed. Output "SKIPPED: Large PR" in that case.`,
      tools: ['Bash', 'Read', 'Grep'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'code-quality': {
      description: 'Code quality - readability, DRY, complexity, CLAUDE.md compliance.',
      prompt: `<task>Review code quality and CLAUDE.md compliance.</task>

<parallel_tool_calls>
Read multiple modified files in parallel to build context faster.
Use Grep to search patterns across files simultaneously.
</parallel_tool_calls>

<investigation>
ALWAYS read and understand relevant files before reporting issues.
Do not speculate about code you have not inspected.
</investigation>

<checks>
1. CLAUDE.md compliance - verify specific guideline violations, quote the guideline
2. Readability - naming conventions, clarity
3. DRY violations - copy-pasted code blocks
4. Complexity - deep nesting (>3 levels), long functions (>50 lines)
5. Error handling patterns
6. Consistency with existing codebase style
</checks>

<output_format>
Only report confidence >= 80:

[QUALITY] Issue title
File: path:line
Issue: specific problem
Guideline: "CLAUDE.md says..." (if applicable)
Suggestion: minimal fix
Confidence: 0-100
</output_format>

Focus on actionable issues. Skip nitpicks and style preferences not in CLAUDE.md.`,
      tools: ['Read', 'Grep', 'Glob'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'test-analyzer': {
      description: 'Runs tests and analyzes coverage. ALWAYS runs tests.',
      prompt: `<task>Run tests and analyze results. NEVER skip running tests.</task>

<parallel_tool_calls>
Execute test discovery and file reads in parallel when possible.
</parallel_tool_calls>

<execution>
1. Detect test runner from package.json (vitest, jest, mocha, etc.)
2. Run tests: pnpm test (or detected runner)
3. Capture full output including failures and coverage
4. Analyze failures for root causes
</execution>

<output_format>
## Test Results
Status: PASS | FAIL
Passed: N / Failed: N / Skipped: N

### Failures
For each failure:
- Test: name
- Error: message
- Likely cause: analysis
- Confidence: 0-100

### Coverage Gaps
For new/modified code lacking tests:
- File: path:lines
- Missing coverage: what's untested
- Suggestion: test case outline
</output_format>

Tests are mandatory. Report test run status even if all pass.`,
      tools: ['Bash', 'Read', 'Glob'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'performance': {
      description: 'Performance issues - N+1, memory leaks, bundle size.',
      prompt: `<task>Analyze performance implications of changes.</task>

<parallel_tool_calls>
Read multiple files simultaneously to understand data flow patterns.
</parallel_tool_calls>

<investigation>
ALWAYS inspect the actual code before reporting performance issues.
Verify patterns exist - do not speculate.
</investigation>

<checks>
1. N+1 queries - DB/API calls inside loops, missing batching
2. Memory leaks - event listeners without cleanup, growing collections
3. Bundle impact - heavy imports (lodash, moment), missing tree-shaking
4. Render performance - React/Vue anti-patterns (inline objects, missing keys)
5. Async patterns - sequential awaits that could parallelize
</checks>

<output_format>
Only report measurable impact, confidence >= 80:

[PERF] Issue title
File: path:line
Pattern: what code does
Issue: specific problem
Impact: estimated effect (e.g., "O(n²) in loop with avg 100 items")
Fix: minimal solution
Confidence: 0-100
</output_format>

Focus on issues with real-world impact. Skip micro-optimizations.`,
      tools: ['Read', 'Grep', 'Glob'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'drawbacks-analyzer': {
      description: 'Edge cases, risks, potential regressions.',
      prompt: `<task>Adversarial analysis of what could go wrong.</task>

<parallel_tool_calls>
Read related files in parallel to understand dependencies and impact.
</parallel_tool_calls>

<analysis>
Evaluate adversarially - consider failure modes:
1. Edge cases - empty inputs, null, unicode, boundary values, negative numbers
2. Regression risks - changes that could break existing behavior
3. Compatibility - browser, Node version, dependency conflicts
4. Scale issues - behavior with 1000x data volume
5. Failure modes - network errors, timeouts, partial failures, recovery
</analysis>

<output_format>
Only report real risks, confidence >= 80:

[RISK] Issue title
File: path:line
Scenario: specific trigger condition
Impact: what breaks
Suggestion: minimal mitigation
Confidence: 0-100
</output_format>

Be selective. Only report risks likely to occur in production.`,
      tools: ['Read', 'Grep', 'Glob', 'Bash'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    // SECURITY TIER (Opus) - Deep reasoning, explicit exploration
    'security-reviewer': {
      description: 'Security audit - OWASP, secrets, injection, auth issues.',
      prompt: `<task>Expert security audit of code changes.</task>

<code_exploration>
ALWAYS read and understand relevant files before reporting vulnerabilities.
Do not speculate about code you have not inspected.
Be rigorous and persistent in searching for security issues.
Verify each finding by examining the actual code path.
</code_exploration>

<minimal_scope>
Avoid over-engineering findings. Report only verified vulnerabilities.
Focus on the specific changes - do not audit the entire codebase.
Each finding must have clear evidence from the code you inspected.
</minimal_scope>

<vulnerability_categories>
Evaluate for:
1. Hardcoded secrets/credentials - API keys, passwords, tokens in source
2. Injection vulnerabilities - SQL, command, template, XSS
3. Authentication gaps - missing auth checks, broken access control
4. Data exposure - sensitive data in logs, error messages, responses
5. Cryptographic issues - weak algorithms, improper key handling
6. SSRF/path traversal - unvalidated URLs or file paths
</vulnerability_categories>

<severity_assessment>
Rate each finding:
- CRITICAL: Direct exploitation path, high impact
- HIGH: Exploitable with some conditions
- MEDIUM: Defense-in-depth issue
- LOW: Minor security hygiene
</severity_assessment>

<output_format>
Only report findings with confidence >= 80:

[SEVERITY] Vulnerability title
File: path:line
Evidence: specific code pattern found
Attack vector: how this could be exploited
Remediation: minimal fix
Confidence: 0-100
</output_format>

Be thorough but precise. Security findings must be verifiable.`,
      tools: ['Read', 'Grep', 'Glob'],
      model: securityModel as 'haiku' | 'sonnet' | 'opus',
    },
  }
}
