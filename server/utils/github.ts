import { Octokit } from 'octokit'

let _octokit: Octokit | null = null

export function getOctokit(): Octokit {
  if (_octokit) return _octokit
  const config = useRuntimeConfig()
  _octokit = new Octokit({ auth: config.githubToken })
  return _octokit
}

export function parseRepoFullName(fullName: string): { owner: string, repo: string } {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo) throw new Error(`Invalid repo: ${fullName}`)
  return { owner, repo }
}

// Convenience wrappers
export async function createIssueComment(owner: string, repo: string, issueNumber: number, body: string) {
  return getOctokit().rest.issues.createComment({ owner, repo, issue_number: issueNumber, body })
}

export async function getPullRequest(owner: string, repo: string, prNumber: number) {
  return getOctokit().rest.pulls.get({ owner, repo, pull_number: prNumber })
}

export async function getPullRequestFiles(owner: string, repo: string, prNumber: number) {
  return getOctokit().rest.pulls.listFiles({ owner, repo, pull_number: prNumber })
}
