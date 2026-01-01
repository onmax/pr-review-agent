import { getModelForAgent } from './config'

// Agent definition type for Claude Code SDK
export interface AgentDefinition {
  description: string
  prompt: string
  tools?: string[]
  model?: 'haiku' | 'sonnet' | 'opus'
  skills?: string[] // Skills this agent should use
  triggers?: string[] // File patterns that trigger this agent
  alwaysSpawn?: boolean // Always spawn regardless of file patterns
}

// Common prompt blocks (DRY)
const CODE_EXPLORATION = `<code_exploration>
ALWAYS read relevant files before reporting issues.
Do not speculate about code you haven't inspected.
Use Read, Grep, Glob tools to investigate thoroughly.
Verify each finding by examining the actual code path.
</code_exploration>`

const MINIMAL_SCOPE = `<minimal_scope>
Only report issues demonstrably present in the code.
Avoid theoretical vulnerabilities without evidence.
Each finding must cite specific file:line evidence.
Focus on the PR changes - do not audit the entire codebase.
</minimal_scope>`

const CONTEXT_GATHERING = `<context_gathering>
If you need more context for confident assessment:
- Use Grep to find related code patterns
- Use Read to inspect imported modules
- Use Bash with git blame to understand history
- Use Bash with git log to find related commits
Do NOT report low-confidence findings. Investigate first.
</context_gathering>`

const PARALLEL_TOOLS = `<parallel_tool_calls>
Call multiple tools simultaneously for efficiency:
- Read multiple files in parallel
- Run independent searches in parallel
</parallel_tool_calls>`

const OUTPUT_THRESHOLD = `<confidence>Only report findings with confidence >= 80.</confidence>`

/**
 * Complete agent catalog with 20+ specialized agents.
 * Agents are dynamically spawned based on PR file patterns.
 * Skills are shared - multiple agents can use the same skills.
 *
 * Model tiers per Anthropic best practices:
 * - Haiku (utility): Fast, direct, simple validation
 * - Sonnet (analysis): Multi-file context, parallel tools
 * - Opus (security): Deep reasoning, avoid "think", use "evaluate/assess"
 */
export function getAgentCatalog(): Record<string, AgentDefinition> {
  const securityModel = getModelForAgent('security')
  const analysisModel = getModelForAgent('analysis')
  const utilityModel = getModelForAgent('utility')

  return {
    // ==========================================
    // ALWAYS SPAWN (core review agents)
    // ==========================================

    'security-reviewer': {
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
      model: securityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'code-quality': {
      description: 'Code quality - readability, DRY, complexity, CLAUDE.md compliance.',
      alwaysSpawn: true,
      skills: [],
      triggers: [],
      prompt: `<task>Review code quality and CLAUDE.md compliance.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. CLAUDE.md compliance - verify specific guideline violations, quote the guideline
2. Readability - naming conventions, clarity
3. DRY violations - copy-pasted code blocks
4. Complexity - deep nesting (>3 levels), long functions (>50 lines)
5. Error handling patterns
6. Consistency with existing codebase style
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[QUALITY] Issue title
File: path:line
Issue: specific problem
Guideline: "CLAUDE.md says..." (if applicable)
Suggestion: minimal fix
Confidence: 0-100
</output_format>

Focus on actionable issues. Skip nitpicks and style preferences not in CLAUDE.md.`,
      tools: ['Read', 'Grep', 'Glob', 'Skill'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    // ==========================================
    // FRAMEWORK AGENTS (spawn based on file patterns)
    // ==========================================

    'nuxt-reviewer': {
      description: 'Nuxt 4+ patterns - server routes, composables, runtimeConfig, h3.',
      alwaysSpawn: false,
      skills: ['nuxt', 'nuxt-modules'],
      triggers: ['nuxt.config.*', 'server/**', 'app/**', 'composables/**', 'plugins/**', 'middleware/**'],
      prompt: `<task>Review Nuxt 4+ patterns and best practices.</task>

<skills>
FIRST, invoke the Skill tool to load guidance:
- Skill tool with skill: "nuxt" for Nuxt 4 patterns
- Skill tool with skill: "nuxt-modules" if reviewing modules
</skills>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. Server routes - proper h3 v1 helpers, validation with zod, error handling
2. Composables - proper use, reactivity patterns, SSR safety
3. runtimeConfig - secrets in private, public for client-side
4. Middleware - auth patterns, redirect handling
5. Plugins - proper initialization, provide/inject
6. Auto-imports - verify imports resolve correctly
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[NUXT] Issue title
File: path:line
Pattern: what should be used
Issue: what's wrong
Suggestion: correct approach
Confidence: 0-100
</output_format>`,
      tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'vue-reviewer': {
      description: 'Vue 3 patterns - Composition API, props/emits, reactivity.',
      alwaysSpawn: false,
      skills: ['vue', 'reka-ui'],
      triggers: ['*.vue', 'components/**', 'layouts/**', 'pages/**'],
      prompt: `<task>Review Vue 3 Composition API patterns.</task>

<skills>
FIRST, invoke the Skill tool:
- Skill tool with skill: "vue" for Vue 3.5+ patterns
- Skill tool with skill: "reka-ui" if using headless components
</skills>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. Composition API - script setup, defineProps/defineEmits
2. Reactivity - ref vs reactive, computed usage, watchEffect
3. Props/emits - proper typing, validation
4. Component design - single responsibility, prop drilling
5. Template patterns - v-bind, v-on, slots
6. VueUse composables - proper usage
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[VUE] Issue title
File: path:line
Pattern: expected approach
Issue: what's wrong
Suggestion: correct pattern
Confidence: 0-100
</output_format>`,
      tools: ['Read', 'Grep', 'Glob', 'Skill'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'api-reviewer': {
      description: 'API routes - h3 helpers, validation, error handling.',
      alwaysSpawn: false,
      skills: ['nuxt', 'nuxt-modules', 'ts-library'],
      triggers: ['server/api/**', 'server/routes/**', 'routes/**'],
      prompt: `<task>Review API route implementation.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. h3 v1 helpers - readBody, getQuery, getRouterParam with validation
2. Input validation - zod schemas, type safety
3. Error handling - createError, proper status codes
4. Response format - consistent structure
5. Authentication - middleware usage
6. Rate limiting considerations
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[API] Issue title
File: path:line
Issue: specific problem
Suggestion: h3 best practice
Confidence: 0-100
</output_format>`,
      tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'nuxthub-reviewer': {
      description: 'NuxtHub patterns - database, KV, blob storage.',
      alwaysSpawn: false,
      skills: ['nuxthub', 'nuxt'],
      triggers: ['**/hub/**', '**/*hub*', '**/useKV*', '**/useBlob*', '**/useDrizzle*', 'drizzle/**'],
      prompt: `<task>Review NuxtHub v0.10+ patterns.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

Use the nuxthub skill for latest patterns.

<checks>
1. Database - Drizzle ORM, proper schema, migrations
2. KV storage - proper key patterns, TTL usage
3. Blob storage - file handling, content types
4. Cache API usage
5. Multi-cloud deployment considerations
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[NUXTHUB] Issue title
File: path:line
Issue: specific problem
Suggestion: NuxtHub best practice
Confidence: 0-100
</output_format>`,
      tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    // ==========================================
    // DOMAIN AGENTS (spawn for specific concerns)
    // ==========================================

    'auth-reviewer': {
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
      model: securityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'db-reviewer': {
      description: 'Database patterns - schema, migrations, queries, Drizzle ORM.',
      alwaysSpawn: false,
      skills: ['nuxthub'],
      triggers: ['**/schema/**', '**/drizzle/**', '**/migrations/**', '**/*.schema.ts', '**/db/**'],
      prompt: `<task>Review database schema and query patterns.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. Schema design - normalization, indexes, constraints
2. Migrations - reversibility, data safety
3. Query patterns - N+1, missing indexes, SQL injection risk
4. Drizzle ORM - proper usage, type safety
5. Transaction handling - atomicity, error rollback
6. Connection management
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[DB] Issue title
File: path:line
Issue: schema/query problem
Impact: performance or data integrity concern
Suggestion: correct approach
Confidence: 0-100
</output_format>`,
      tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'a11y-reviewer': {
      description: 'Accessibility - ARIA, semantic HTML, keyboard navigation.',
      alwaysSpawn: false,
      skills: ['vue', 'reka-ui'],
      triggers: ['*.vue', 'components/**'],
      prompt: `<task>Review accessibility patterns.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}

Use reka-ui skill for headless component patterns.

<checks>
1. Semantic HTML - proper heading hierarchy, landmarks
2. ARIA attributes - roles, labels, descriptions
3. Keyboard navigation - focus management, tab order
4. Screen reader - alt text, announcements
5. Color contrast considerations
6. Reka UI - proper composition patterns
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[A11Y] Issue title
File: path:line
Issue: accessibility problem
WCAG: guideline reference
Suggestion: accessible implementation
Confidence: 0-100
</output_format>`,
      tools: ['Read', 'Grep', 'Glob', 'Skill'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'i18n-reviewer': {
      description: 'Internationalization - translations, locale handling.',
      alwaysSpawn: false,
      skills: ['nuxt'],
      triggers: ['**/locales/**', '**/*i18n*'],
      prompt: `<task>Review i18n patterns.</task>

${CODE_EXPLORATION}

<checks>
1. Hardcoded strings - should use $t()
2. Missing translations - keys without values
3. Locale handling - proper detection, switching
4. Pluralization - proper handling
5. Date/number formatting - locale-aware
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[I18N] Issue title
File: path:line
Issue: i18n problem
Suggestion: proper approach
Confidence: 0-100
</output_format>`,
      tools: ['Read', 'Grep', 'Glob', 'Skill'],
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    // ==========================================
    // TYPE & QUALITY AGENTS
    // ==========================================

    'typescript-reviewer': {
      description: 'TypeScript - complex types, generics, type safety.',
      alwaysSpawn: false,
      skills: ['ts-library'],
      triggers: ['*.ts', '*.tsx', '!*.d.ts'],
      prompt: `<task>Review TypeScript patterns and type safety.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}

Use ts-library skill for advanced patterns.

<checks>
1. Type safety - avoid any, unknown when possible
2. Generics - proper constraints, inference
3. Utility types - Pick, Omit, Partial usage
4. Type narrowing - proper guards
5. Declaration files - accurate exports
6. Inference - let TypeScript infer when clear
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[TS] Issue title
File: path:line
Issue: type safety problem
Suggestion: better typing
Confidence: 0-100
</output_format>`,
      tools: ['Read', 'Grep', 'Glob', 'Skill'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'test-analyzer': {
      description: 'Test execution and coverage analysis.',
      alwaysSpawn: false,
      skills: [],
      triggers: ['*.test.*', '*.spec.*', '__tests__/**', 'test/**', 'tests/**'],
      prompt: `<task>Run tests and analyze results. NEVER skip running tests.</task>

${PARALLEL_TOOLS}

<execution>
1. Detect test runner from package.json (vitest, jest, mocha)
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
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'perf-reviewer': {
      description: 'Performance - N+1, memory, bundle size, render.',
      alwaysSpawn: false,
      skills: [],
      triggers: [], // Spawned by orchestrator based on code analysis
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
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    // ==========================================
    // INFRASTRUCTURE AGENTS
    // ==========================================

    'deps-reviewer': {
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
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'config-reviewer': {
      description: 'Configuration files - nuxt.config, tsconfig, env.',
      alwaysSpawn: false,
      skills: ['nuxt'],
      triggers: ['*.config.ts', '*.config.js', 'tsconfig.json', '.env*', '!.env.example'],
      prompt: `<task>Review configuration changes.</task>

${CODE_EXPLORATION}

<checks>
1. Security - no secrets in config (should be in env)
2. Correctness - valid options, no deprecated settings
3. Compatibility - Node version, browser targets
4. Performance - build optimization settings
5. Environment handling - proper .env usage
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[CONFIG] Issue title
File: path
Issue: configuration problem
Suggestion: correct setting
Confidence: 0-100
</output_format>`,
      tools: ['Read', 'Glob', 'Grep'],
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'ci-reviewer': {
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
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    // ==========================================
    // DOCUMENTATION AGENTS
    // ==========================================

    'doc-checker': {
      description: 'Documentation - README, CHANGELOG, JSDoc.',
      alwaysSpawn: false,
      skills: [],
      triggers: ['README*', 'CHANGELOG*', 'docs/**', '*.md'],
      prompt: `<task>Quick documentation review.</task>

<checks>
1. README updates - new features documented
2. CHANGELOG - breaking changes noted
3. JSDoc - exported functions documented
4. Code comments - complex logic explained
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[DOCS] Issue title
File: path
Gap: what's missing
Suggestion: what to add
Confidence: 0-100
</output_format>

Quick pass only. Do not over-report minor gaps.`,
      tools: ['Read', 'Glob'],
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'breaking-change': {
      description: 'Breaking changes - public API, exports.',
      alwaysSpawn: false,
      skills: [],
      triggers: [], // Spawned by orchestrator based on export changes
      prompt: `<task>Identify breaking changes.</task>

${CODE_EXPLORATION}

<checks>
1. Export changes - removed, renamed
2. Function signatures - parameter changes
3. Type changes - stricter or different types
4. Behavior changes - different return values
5. Default value changes
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[BREAKING] Change description
File: path:line
Before: previous behavior/signature
After: new behavior/signature
Migration: how to update consumers
Confidence: 0-100
</output_format>`,
      tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    // ==========================================
    // HISTORY & CONTEXT AGENTS
    // ==========================================

    'git-historian': {
      description: 'Git history - blame, related PRs, patterns.',
      alwaysSpawn: false,
      skills: [],
      triggers: [], // Available on demand
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
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'impact-analyzer': {
      description: 'Cross-file impact analysis.',
      alwaysSpawn: false,
      skills: [],
      triggers: [], // Spawned for larger PRs
      prompt: `<task>Analyze cross-file dependencies and impact.</task>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}

<analysis>
1. Find all imports of modified files
2. Identify callers of changed functions
3. Check for type dependencies
4. Map the blast radius of changes
</analysis>

<output_format>
## Impact Analysis

### Files Affected
- path: description of impact

### Dependency Chain
[Visualization of dependencies]

### Risk Areas
[Parts of codebase that might be affected]
</output_format>`,
      tools: ['Read', 'Grep', 'Glob', 'Bash', 'Skill'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    // ==========================================
    // UTILITY AGENTS
    // ==========================================

    'git-validator': {
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
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'drawbacks-analyzer': {
      description: 'Edge cases, risks, potential regressions.',
      alwaysSpawn: false,
      skills: [],
      triggers: [], // Spawned for medium/large PRs
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
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },

    'critic-agent': {
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
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    'github-api': {
      description: 'Posts review results via GitHub REST API.',
      alwaysSpawn: false,
      skills: [],
      triggers: [],
      prompt: `<task>Post PR review comment via GitHub REST API.</task>

<environment>
Use these env vars:
- GITHUB_TOKEN: Bearer token for auth
- PR_OWNER: Repository owner
- PR_REPO: Repository name
- PR_NUMBER: Pull request number
</environment>

<api_call>
Use gh CLI: gh issue comment $PR_NUMBER --repo $PR_OWNER/$PR_REPO --body "COMMENT"
</api_call>

<link_format>
Always use full SHA in code links:
https://github.com/OWNER/REPO/blob/FULL_SHA/path#L10-L15
</link_format>

Execute the API call with the provided review content.`,
      tools: ['Bash'],
      model: utilityModel as 'haiku' | 'sonnet' | 'opus',
    },

    // ==========================================
    // REPRODUCTION AGENT (standalone, not for PR reviews)
    // ==========================================

    'repro-creator': {
      description: 'Creates bug reproduction + fixed version with pnpm patch, pushes to repros repo.',
      alwaysSpawn: false,
      skills: ['nuxt', 'vue', 'nuxthub'],
      triggers: [],
      prompt: `<task>Create a bug reproduction AND a fixed version for a GitHub issue.</task>

<first_step>
ALWAYS read ~/repros/CLAUDE.md first - it contains the full workflow and conventions.
</first_step>

<working_directory>
All work happens in ~/repros. You have full Bash access to run any command.
</working_directory>

<workflow>
## Phase 1: Bug Reproduction
1. Read ~/repros/CLAUDE.md for conventions
2. Fetch issue: \`gh issue view {url}\`
3. Create folder: \`{library}-{issue-number}\` in ~/repros
4. Scaffold minimal project, add code to reproduce bug
5. Create README.md, verify bug is reproducible

## Phase 2: Fixed Version
1. Copy: \`cp -r {folder} {folder}-fixed\`
2. \`pnpm patch {package}\` → apply fix → \`pnpm patch-commit '{path}'\`
3. Verify fix, update README with ## Fix section

## Phase 3: Push
git add both folders && git commit -m "add {library}-{issue} repro" && git push
</workflow>

<output_format>
**Bug**: https://github.com/onmax/repros/tree/main/{folder}
**Fixed**: https://github.com/onmax/repros/tree/main/{folder}-fixed
**Commit**: https://github.com/onmax/repros/commit/{SHA}
</output_format>`,
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch'],
      model: analysisModel as 'haiku' | 'sonnet' | 'opus',
    },
  }
}

/**
 * Get agents that should be spawned for given file patterns.
 * Returns array of agent names to spawn.
 */
export function getAgentsForFiles(files: string[]): string[] {
  const catalog = getAgentCatalog()
  const agentsToSpawn = new Set<string>()

  // Always spawn core agents
  for (const [name, agent] of Object.entries(catalog)) {
    if (agent.alwaysSpawn) {
      agentsToSpawn.add(name)
    }
  }

  // Check each file against agent triggers
  for (const file of files) {
    for (const [name, agent] of Object.entries(catalog)) {
      if (!agent.triggers || agent.triggers.length === 0)
        continue
      for (const trigger of agent.triggers) {
        if (matchesTrigger(file, trigger)) {
          agentsToSpawn.add(name)
          break
        }
      }
    }
  }

  return Array.from(agentsToSpawn)
}

/**
 * Simple glob-like matching for trigger patterns.
 */
function matchesTrigger(file: string, pattern: string): boolean {
  // Handle negation
  if (pattern.startsWith('!')) {
    return !matchesTrigger(file, pattern.slice(1))
  }

  // Handle ** (any path)
  if (pattern.includes('**')) {
    const regex = new RegExp(`^${pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')}$`)
    return regex.test(file)
  }

  // Handle * (single segment)
  if (pattern.includes('*')) {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '[^/]*')}$`)
    return regex.test(file)
  }

  // Exact match or contains
  return file.includes(pattern)
}

/**
 * Get skills needed for a set of agents.
 */
export function getSkillsForAgents(agentNames: string[]): string[] {
  const catalog = getAgentCatalog()
  const skills = new Set<string>()

  for (const name of agentNames) {
    const agent = catalog[name]
    if (agent?.skills) {
      for (const skill of agent.skills) {
        skills.add(skill)
      }
    }
  }

  return Array.from(skills)
}
