import { execFileSync, spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { consola } from 'consola'
import { ofetch } from 'ofetch'
import { join } from 'pathe'
import { getAgentCatalog, getAgentsForFiles } from './agents'
import { createIssueComment, getCloneToken, parseRepoFullName, updateIssueComment } from './github'

const logger = consola.withTag('pr-review')
const SKILLS_URL = 'https://raw.githubusercontent.com/onmax/nuxt-skills/main/skills'

export interface WebhookPayload {
  repository: { full_name: string, clone_url: string }
  issue: { number: number }
  comment: { body: string, user: { login: string }, id?: number }
  installationId?: number // GitHub App installation ID
}

export function spawnClaudeReview(payload: WebhookPayload): void {
  const jobId = `${payload.repository.full_name}#${payload.issue.number}`
  logger.info(`Starting job ${jobId}`)
  runReview(payload).catch(err => logger.error(`Job ${jobId} failed:`, err))
}

async function runReview(payload: WebhookPayload): Promise<void> {
  const { owner, repo } = parseRepoFullName(payload.repository.full_name)
  const prNumber = payload.issue.number
  const installationId = payload.installationId
  const workDir = await mkdtemp(join(tmpdir(), 'pr-review-'))

  // Get or create status comment - we'll update this one comment throughout the review
  let commentId = payload.comment.id
  if (!commentId) {
    const { data } = await createIssueComment(owner, repo, prNumber, '🔍 Starting PR review...', installationId)
    commentId = data.id
  }

  const updateStatus = async (body: string) => {
    await updateIssueComment(owner, repo, commentId!, body, installationId).catch(() => {})
  }

  try {
    // Get token for cloning - uses installation token if available, else PAT
    const token = await getCloneToken(installationId)
    const cloneUrl = payload.repository.clone_url.replace('https://', `https://x-access-token:${token}@`)

    await updateStatus('🔍 Cloning repository...')
    logger.info(`Cloning ${owner}/${repo} PR #${prNumber}`)
    execFileSync('git', ['clone', '--depth=50', cloneUrl, workDir], { stdio: 'pipe' })
    execFileSync('git', ['fetch', 'origin', `pull/${prNumber}/head:pr-branch`], { cwd: workDir, stdio: 'pipe' })
    execFileSync('git', ['checkout', 'pr-branch'], { cwd: workDir, stdio: 'pipe' })

    // Get changed files to determine which agents to spawn
    const changedFiles = getChangedFiles(workDir)
    logger.info(`PR has ${changedFiles.length} changed files`)

    // Dynamically determine agents based on file patterns
    const agentsToSpawn = getAgentsForFiles(changedFiles)
    logger.info(`Spawning ${agentsToSpawn.length} agents: ${agentsToSpawn.join(', ')}`)

    await updateStatus(`🔍 Analyzing ${changedFiles.length} files with ${agentsToSpawn.length} agents:\n${agentsToSpawn.map(a => `- ${a}`).join('\n')}`)

    await ensureSkills()

    const prompt = buildOrchestratorPrompt(owner, repo, prNumber, changedFiles, agentsToSpawn)

    logger.info('Running Claude Code (sandbox + bypassPermissions)')
    const result = await runClaudeCLI(workDir, prompt, token)

    logger.success(`Completed PR #${prNumber}`)
    if (result)
      logger.info(`Output: ${result.length} chars`)

    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
  catch (error) {
    logger.error('Failed:', error)
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
    await updateStatus(`❌ Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function getChangedFiles(workDir: string): string[] {
  for (const base of ['origin/main', 'origin/master', 'HEAD~1']) {
    try {
      const output = execFileSync('git', ['diff', '--name-only', base], { cwd: workDir, encoding: 'utf-8' })
      return output.trim().split('\n').filter(Boolean)
    }
    catch { continue }
  }
  return []
}

async function ensureSkills(): Promise<void> {
  const skillsDir = join(homedir(), '.claude', 'skills')
  const skills = ['nuxt', 'vue', 'nuxt-modules', 'nuxthub', 'reka-ui']

  for (const skill of skills) {
    const skillPath = join(skillsDir, skill, 'SKILL.md')
    try {
      await import('node:fs/promises').then(fs => fs.access(skillPath))
    }
    catch {
      logger.info(`Downloading skill: ${skill}`)
      try {
        const content = await ofetch(`${SKILLS_URL}/${skill}/SKILL.md`, { responseType: 'text' })
        await mkdir(join(skillsDir, skill), { recursive: true })
        await writeFile(skillPath, content)
      }
      catch { logger.warn(`Failed to download: ${skill}`) }
    }
  }
}

function runClaudeCLI(cwd: string, prompt: string, githubToken: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const claude = spawn('claude', ['--print', '--dangerously-skip-permissions', prompt], {
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
      if (code === 0)
        resolve(stdout)
      else reject(new Error(`Claude exited ${code}: ${stderr.slice(0, 500)}`))
    })

    claude.on('error', err => reject(new Error(`Spawn failed: ${err.message}`)))
  })
}

function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number, changedFiles: string[], agentsToSpawn: string[]): string {
  const catalog = getAgentCatalog()

  // Build agent task list dynamically
  const agentTasks = agentsToSpawn.map((name, idx) => {
    const agent = catalog[name]
    if (!agent)
      return ''

    const model = agent.model || 'sonnet'
    const skills = agent.skills?.length ? `Use skills: ${agent.skills.join(', ')}.` : ''

    return `${idx + 1}. **${name}** (subagent_type: "general-purpose", model: "${model}")
   "${agent.description} ${skills}"`
  }).filter(Boolean).join('\n\n')

  const filesList = changedFiles.slice(0, 50).join('\n   - ')
  const truncatedNote = changedFiles.length > 50 ? `\n   (and ${changedFiles.length - 50} more files)` : ''

  return `<task>Code review PR #${prNumber} in ${owner}/${repo}.</task>

<context>
Changed files (${changedFiles.length}):
   - ${filesList}${truncatedNote}
</context>

<workflow>
## Step 1: Understand Changes
Run git diff --stat to see scope and understand the changes.

## Step 2: Parallel Review (${agentsToSpawn.length} agents)
Launch these Task subagents in parallel. Each agent has full tool access (Read, Grep, Glob, Bash) and should investigate code thoroughly before reporting.

${agentTasks}

## Step 3: Aggregate Results
After all agents complete:
1. Collect all findings
2. Remove duplicates (same issue from multiple agents)
3. Filter findings with confidence < 80
4. Verify evidence is cited for each finding

## Step 4: Quality Check
Launch critic-agent to validate aggregated findings:
- Ensure each finding has file:line reference
- Ensure each finding is actionable
- Remove nitpicks and style-only issues

## Step 5: Post Review
Use gh CLI to post the review (GITHUB_TOKEN is set in env):

gh issue comment ${prNumber} --repo ${owner}/${repo} --body "[REVIEW_CONTENT]"

Format:
### 🔍 Code Review

**Reviewed by ${agentsToSpawn.length} agents**: ${agentsToSpawn.join(', ')}

Found N issues:

#### [SEVERITY] Issue title
**File**: \`path:line\` ([view](https://github.com/${owner}/${repo}/blob/SHA/path#L10-L15))
**Issue**: description
**Fix**: suggestion

---

🤖 Generated with [pr-review-agent](https://github.com/onmax/pr-review-agent)

If no issues found:
### ✅ Code Review
**Reviewed by ${agentsToSpawn.length} agents**: ${agentsToSpawn.join(', ')}

No issues found. The code looks good!

🤖 Generated with [pr-review-agent](https://github.com/onmax/pr-review-agent)
</workflow>

<parallel_tool_calls>
Launch all ${agentsToSpawn.length} Task calls in one message for parallel execution.
Do NOT wait for one agent before launching others.
</parallel_tool_calls>

<confidence_threshold>Only report findings with confidence >= 80.</confidence_threshold>

<agent_autonomy>
Each agent has full tool access and should:
- Read relevant files before reporting issues
- Use Grep to find patterns
- Use Bash for git blame/history if needed
- NOT speculate about code they haven't inspected
</agent_autonomy>

Begin.`
}
