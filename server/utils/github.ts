import { Octokit } from 'octokit'
import { getInstallationOctokit, getInstallationToken, isGitHubAppConfigured } from './github-app'

let _patOctokit: Octokit | null = null

// Get Octokit client - prefers installation token, falls back to PAT
async function getOctokit(installationId?: number): Promise<Octokit> {
  // Use installation token if available
  if (installationId && isGitHubAppConfigured()) {
    return getInstallationOctokit(installationId)
  }

  // Fallback to PAT
  if (!_patOctokit) {
    const config = useRuntimeConfig()
    if (!config.githubToken) {
      throw new Error('No GitHub auth configured. Set NUXT_GITHUB_APP_ID + NUXT_GITHUB_APP_PRIVATE_KEY or NUXT_GITHUB_TOKEN')
    }
    _patOctokit = new Octokit({ auth: config.githubToken })
  }
  return _patOctokit
}

// Get raw token for git clone - prefers installation token, falls back to PAT
export async function getCloneToken(installationId?: number): Promise<string> {
  if (installationId && isGitHubAppConfigured()) {
    return getInstallationToken(installationId)
  }

  const config = useRuntimeConfig()
  if (!config.githubToken) {
    throw new Error('No GitHub token for cloning. Set NUXT_GITHUB_TOKEN for external repos')
  }
  return config.githubToken
}

export function parseRepoFullName(fullName: string): { owner: string, repo: string } {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo)
    throw new Error(`Invalid repo: ${fullName}`)
  return { owner, repo }
}

// Convenience wrappers - all take optional installationId for GitHub App support
export async function createIssueComment(owner: string, repo: string, issueNumber: number, body: string, installationId?: number) {
  const octokit = await getOctokit(installationId)
  return octokit.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body })
}

export async function updateIssueComment(owner: string, repo: string, commentId: number, body: string, installationId?: number) {
  const octokit = await getOctokit(installationId)
  return octokit.rest.issues.updateComment({ owner, repo, comment_id: commentId, body })
}

export async function getPullRequest(owner: string, repo: string, prNumber: number, installationId?: number) {
  const octokit = await getOctokit(installationId)
  return octokit.rest.pulls.get({ owner, repo, pull_number: prNumber })
}

export async function getPullRequestFiles(owner: string, repo: string, prNumber: number, installationId?: number) {
  const octokit = await getOctokit(installationId)
  return octokit.rest.pulls.listFiles({ owner, repo, pull_number: prNumber })
}
