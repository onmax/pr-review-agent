import { execFileSync, spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { consola } from 'consola'
import { ofetch } from 'ofetch'
import { createIssueComment, parseRepoFullName } from './github'
import { getValidatedConfig } from './config'
import { getAgentsForFiles, getSkillsForAgents, getAgentCatalog } from './agents'

const logger = consola.withTag('pr-review')

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

    // Get changed files to determine which agents to spawn
    const changedFiles = getChangedFiles(workDir)
    logger.info(`PR has ${changedFiles.length} changed files`)

    // Dynamically determine agents based on file patterns
    const agentsToSpawn = getAgentsForFiles(changedFiles)
    logger.info(`Spawning ${agentsToSpawn.length} agents: ${agentsToSpawn.join(', ')}`)

    // Get skills needed for these agents
    const skillsToDownload = getSkillsForAgents(agentsToSpawn)
    logger.info(`Downloading ${skillsToDownload.length} skills: ${skillsToDownload.join(', ')}`)

    await createIssueComment(owner, repo, prNumber, `🔍 Starting PR review with ${agentsToSpawn.length} agents... This may take a few minutes.`)

    await downloadSkills(workDir, skillsToDownload)

    const prompt = buildOrchestratorPrompt(owner, repo, prNumber, changedFiles, agentsToSpawn)
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

function getChangedFiles(workDir: string): string[] {
  // Try main, then master, then HEAD~1
  for (const base of ['origin/main', 'origin/master', 'HEAD~1']) {
    try {
      const output = execFileSync('git', ['diff', '--name-only', base], { cwd: workDir, encoding: 'utf-8' })
      return output.trim().split('\n').filter(Boolean)
    }
    catch { continue }
  }
  return []
}

async function downloadSkills(workDir: string, skills: string[]): Promise<void> {
  if (skills.length === 0) {
    logger.info('No skills to download')
    return
  }

  const skillsDir = join(workDir, '.claude', 'skills')
  await mkdir(skillsDir, { recursive: true })

  await Promise.all(skills.map(async (skill) => {
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

function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number, changedFiles: string[], agentsToSpawn: string[]): string {
  const catalog = getAgentCatalog()

  // Build agent task list dynamically
  const agentTasks = agentsToSpawn.map((name, idx) => {
    const agent = catalog[name]
    if (!agent) return ''

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
