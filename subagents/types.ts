export interface AgentDefinition {
  description: string
  prompt: string
  tools?: string[]
  model?: 'haiku' | 'sonnet' | 'opus'
  skills?: string[]
  triggers?: string[]
  alwaysSpawn?: boolean
}

// Common prompt blocks
export const CODE_EXPLORATION = `<code_exploration>
ALWAYS read relevant files before reporting issues.
Do not speculate about code you haven't inspected.
Use Read, Grep, Glob tools to investigate thoroughly.
Verify each finding by examining the actual code path.
</code_exploration>`

export const MINIMAL_SCOPE = `<minimal_scope>
Only report issues demonstrably present in the code.
Avoid theoretical vulnerabilities without evidence.
Each finding must cite specific file:line evidence.
Focus on the PR changes - do not audit the entire codebase.
</minimal_scope>`

export const CONTEXT_GATHERING = `<context_gathering>
If you need more context for confident assessment:
- Use Grep to find related code patterns
- Use Read to inspect imported modules
- Use Bash with git blame to understand history
- Use Bash with git log to find related commits
Do NOT report low-confidence findings. Investigate first.
</context_gathering>`

export const PARALLEL_TOOLS = `<parallel_tool_calls>
Call multiple tools simultaneously for efficiency:
- Read multiple files in parallel
- Run independent searches in parallel
</parallel_tool_calls>`

export const OUTPUT_THRESHOLD = `<confidence>Only report findings with confidence >= 80.</confidence>`
