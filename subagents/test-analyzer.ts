import type { AgentDefinition } from './types'
import { PARALLEL_TOOLS } from './types'

export const testAnalyzer: AgentDefinition = {
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
  model: 'haiku',
}
