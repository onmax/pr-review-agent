import type { AgentDefinition } from './types'

export const reproCreator: AgentDefinition = {
  description: 'Creates bug reproduction + fixed version with pnpm patch, pushes to repros repo.',
  alwaysSpawn: true,
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
  model: 'sonnet',
}
