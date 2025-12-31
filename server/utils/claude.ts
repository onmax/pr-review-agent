import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { consola } from 'consola'
import { ofetch } from 'ofetch'
import { createIssueComment, parseRepoFullName } from './github'
import { getValidatedConfig } from './config'

const logger = consola.withTag('pr-review')

// Skills for code review (downloaded from GitHub)
const REVIEW_SKILLS = ['vue', 'nuxt', 'nuxt-modules', 'ts-library']
const SKILLS_BASE_URL = 'https://raw.githubusercontent.com/onmax/nuxt-skills/main/skills'

export interface WebhookPayload {
  repository: { full_name: string, clone_url: string }
  issue: { number: number }
  comment: { body: string, user: { login: string } }
}

export function spawnClaudeReview(payload: WebhookPayload): void {
  const jobId = `${payload.repository.full_name}#${payload.issue.number}`
  logger.info(`Starting job ${jobId}`)
  runReview(payload).catch(err => logger.error(`Job ${jobId} failed:`, err))
}

async function runReview(payload: WebhookPayload): Promise<void> {
  const { owner, repo } = parseRepoFullName(payload.repository.full_name)
  const prNumber = payload.issue.number
  const workDir = await mkdtemp(join(tmpdir(), 'pr-review-'))

  const config = getValidatedConfig()

  try {
    const cloneUrl = payload.repository.clone_url.replace('https://', `https://x-access-token:${config.githubToken}@`)

    logger.info(`Cloning ${owner}/${repo} PR #${prNumber}`)
    execFileSync('git', ['clone', '--depth=50', cloneUrl, workDir], { stdio: 'pipe' })
    execFileSync('git', ['fetch', 'origin', `pull/${prNumber}/head:pr-branch`], { cwd: workDir, stdio: 'pipe' })
    execFileSync('git', ['checkout', 'pr-branch'], { cwd: workDir, stdio: 'pipe' })

    await createIssueComment(owner, repo, prNumber, `🔍 Starting PR review... This may take a few minutes.`)

    await downloadSkills(workDir)

    const prompt = buildOrchestratorPrompt(owner, repo, prNumber)
    const promptFile = join(workDir, '.review-prompt.txt')
    await writeFile(promptFile, prompt)

    logger.info('Running Claude Code (sandbox + bypassPermissions)')
    const result = await runClaudeCLI(workDir, promptFile, config.githubToken)

    logger.success(`Completed PR #${prNumber}`)
    if (result) logger.info(`Output: ${result.length} chars`)

    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
  catch (error) {
    logger.error('Failed:', error)
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
    await createIssueComment(owner, repo, prNumber, `❌ Review failed. Check server logs.`).catch(() => {})
  }
}

async function downloadSkills(workDir: string): Promise<void> {
  const skillsDir = join(workDir, '.claude', 'skills')
  await mkdir(skillsDir, { recursive: true })

  await Promise.all(REVIEW_SKILLS.map(async (skill) => {
    try {
      const content = await ofetch(`${SKILLS_BASE_URL}/${skill}/SKILL.md`, { responseType: 'text' })
      const skillDir = join(skillsDir, skill)
      await mkdir(skillDir, { recursive: true })
      await writeFile(join(skillDir, 'SKILL.md'), content)
      logger.info(`Downloaded skill: ${skill}`)
    }
    catch {
      logger.warn(`Failed to download skill: ${skill}`)
    }
  }))
}

function runClaudeCLI(cwd: string, promptFile: string, githubToken: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--print', '--dangerously-skip-permissions', '--input-file', promptFile], {
      cwd,
      env: { ...process.env, GITHUB_TOKEN: githubToken },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    claude.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
      process.stdout.write(data)
    })

    claude.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
      process.stderr.write(data)
    })

    claude.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`Claude exited ${code}: ${stderr.slice(0, 500)}`))
    })

    claude.on('error', (err) => reject(new Error(`Spawn failed: ${err.message}`)))
  })
}

function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `<task>Code review PR #${prNumber} in ${owner}/${repo}.</task>

<workflow>
## Step 1: Understand Changes
Run git diff --stat to see scope.

## Step 2: Parallel Review
Launch these Task subagents in parallel:

1. **nuxt-reviewer** (subagent_type: "Explore", model: "sonnet")
   "Review Nuxt patterns: composables, server routes, h3 patterns, runtimeConfig. Use nuxt skill. Confidence >= 80."

2. **vue-reviewer** (subagent_type: "Explore", model: "sonnet")
   "Review Vue patterns: Composition API, props/emits, reactivity. Use vue skill. Confidence >= 80."

3. **security-reviewer** (subagent_type: "Explore", model: "opus")
   "Security audit: secrets, injection, auth gaps, data exposure. Confidence >= 80."

4. **test-runner** (subagent_type: "general-purpose", model: "haiku")
   "Run pnpm test. Report pass/fail and errors."

## Step 3: Post Comment
Use gh CLI to post the review (GITHUB_TOKEN is set in env):

gh issue comment ${prNumber} --repo ${owner}/${repo} --body "[REVIEW_CONTENT]"

Format:
### Code review

Found N issues:

1. [SEVERITY] Title (reason)
   https://github.com/${owner}/${repo}/blob/SHA/path#L10-L15

...

🤖 Generated with [pr-review-agent](https://github.com/onmax/pr-review-agent)

If no issues: "No issues found. Checked Nuxt, Vue, security, and tests."
</workflow>

<parallel_tool_calls>Launch all 4 Task calls in one message.</parallel_tool_calls>
<confidence_threshold>Only report confidence >= 80.</confidence_threshold>

Begin.`
}
