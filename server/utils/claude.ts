import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile, mkdir, cp } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { createGitHubClient, parseRepoFullName } from './github'
import { getValidatedConfig } from './config'

export interface WebhookPayload {
  repository: { full_name: string, clone_url: string }
  issue: { number: number }
  comment: { body: string, user: { login: string } }
}

export function spawnClaudeReview(payload: WebhookPayload): void {
  const jobId = `${payload.repository.full_name}#${payload.issue.number}`
  console.log(`[Review] Starting job ${jobId}`)
  runReview(payload).catch(err => console.error(`[Review] Job ${jobId} failed:`, err))
}

async function runReview(payload: WebhookPayload): Promise<void> {
  const { owner, repo } = parseRepoFullName(payload.repository.full_name)
  const prNumber = payload.issue.number
  const workDir = await mkdtemp(join(tmpdir(), 'pr-review-'))

  const config = getValidatedConfig()
  const github = createGitHubClient({ token: config.githubToken })

  try {
    // Clone repo using execFileSync (prevents command injection)
    const cloneUrl = payload.repository.clone_url.replace('https://', `https://x-access-token:${config.githubToken}@`)

    console.log(`[PR Review] Cloning ${owner}/${repo} PR #${prNumber} to ${workDir}`)
    execFileSync('git', ['clone', '--depth=50', cloneUrl, workDir], { stdio: 'pipe' })
    execFileSync('git', ['fetch', 'origin', `pull/${prNumber}/head:pr-branch`], { cwd: workDir, stdio: 'pipe' })
    execFileSync('git', ['checkout', 'pr-branch'], { cwd: workDir, stdio: 'pipe' })

    await github.createIssueComment(owner, repo, prNumber, `🔍 Starting PR review... This may take a few minutes.`)

    // Copy Nuxt skills to workDir/.claude/skills
    const skillsSource = join(homedir(), 'nuxt', 'skills', 'skills')
    const skillsDest = join(workDir, '.claude', 'skills')
    await mkdir(join(workDir, '.claude'), { recursive: true })
    await cp(skillsSource, skillsDest, { recursive: true }).catch(() => {
      console.log('[PR Review] No Nuxt skills found at ~/nuxt/skills/skills, continuing without them')
    })

    // Write the review prompt
    const prompt = buildOrchestratorPrompt(owner, repo, prNumber)
    const promptFile = join(workDir, '.review-prompt.txt')
    await writeFile(promptFile, prompt)

    console.log(`[PR Review] Running Claude Code (native sandbox + bypassPermissions)`)

    // Run Claude Code CLI with:
    // - Native bubblewrap sandbox (auto-enabled on Linux)
    // - bypassPermissions for autonomous execution
    const result = await runClaudeCLI(workDir, promptFile, config.githubToken)

    console.log(`[PR Review] Completed PR #${prNumber}`)
    if (result) console.log(`[PR Review] Output length: ${result.length} chars`)

    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
  catch (error) {
    console.error(`[PR Review] Failed:`, error)
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
    await github.createIssueComment(owner, repo, prNumber, `❌ Review failed. Check server logs.`).catch(console.error)
  }
}

function runClaudeCLI(cwd: string, promptFile: string, githubToken: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', [
      '--print', // Output result to stdout
      '--dangerously-skip-permissions', // Bypass permission prompts (sandboxed by bubblewrap)
      '--input-file', promptFile,
    ], {
      cwd,
      env: {
        ...process.env,
        GITHUB_TOKEN: githubToken,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    claude.stdout.on('data', (data: Buffer) => {
      const text = data.toString()
      stdout += text
      process.stdout.write(text) // Stream to console
    })

    claude.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      stderr += text
      process.stderr.write(text)
    })

    claude.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 500)}`))
    })

    claude.on('error', (err) => reject(new Error(`Failed to spawn Claude CLI: ${err.message}`)))
  })
}

function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `<task>Perform a comprehensive code review of PR #${prNumber} in ${owner}/${repo}.</task>

<workflow>
You are a PR review orchestrator. Launch specialized subagents to analyze different aspects of the code, then aggregate findings.

## Step 1: Validation
Run git status and git diff --stat to understand the scope of changes.

## Step 2: Launch Parallel Subagents
Use the Task tool to spawn these subagents in parallel (send all Task calls in one message):

1. **nuxt-reviewer** (subagent_type: "Explore", model: "sonnet")
   Prompt: "Review Nuxt-specific patterns in the PR changes. Check for: proper use of composables, server routes following h3 patterns, correct middleware usage, proper runtimeConfig access. Use the nuxt skill if available. Report issues with confidence >= 80."

2. **vue-reviewer** (subagent_type: "Explore", model: "sonnet")
   Prompt: "Review Vue component patterns in the PR changes. Check for: Composition API best practices, proper props/emits usage, reactive destructuring issues. Use the vue skill if available. Report issues with confidence >= 80."

3. **security-reviewer** (subagent_type: "Explore", model: "opus")
   Prompt: "Security audit of PR changes. Evaluate for: hardcoded secrets, injection vulnerabilities (SQL/command/XSS), missing auth checks, data exposure in logs. Only report verified vulnerabilities with confidence >= 80."

4. **test-runner** (subagent_type: "general-purpose", model: "haiku")
   Prompt: "Run pnpm test (or npm test if no pnpm) and report results. Include: test pass/fail status, any failures with their errors."

## Step 3: Aggregate Findings
Collect all subagent findings. Filter to confidence >= 80 only.

## Step 4: Post Review Comment
Use curl to post a GitHub comment. GITHUB_TOKEN is in the environment.

curl -s -X POST -H "Authorization: Bearer $GITHUB_TOKEN" \\
  -H "Accept: application/vnd.github.v3+json" \\
  "https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments" \\
  -d '{"body": "[REVIEW_CONTENT]"}'

Format:
### Code review

Found N issues:

1. [SEVERITY] Issue title (reason)
   https://github.com/${owner}/${repo}/blob/FULL_SHA/path#L10-L15

...

🤖 Generated with Claude Code

If no issues:
### Code review

No issues found. Checked Nuxt patterns, Vue best practices, security, and tests.

🤖 Generated with Claude Code
</workflow>

<parallel_tool_calls>
Launch all 4 subagent Task calls in a single message.
</parallel_tool_calls>

<confidence_threshold>
Only include issues with confidence >= 80. Skip nitpicks and things linters catch.
</confidence_threshold>

Begin the review now.`
}
