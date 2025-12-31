interface GitHubClientOptions {
  token?: string
  baseUrl?: string
}

interface ResolvedOptions {
  token: string
  baseUrl: string
}

function resolveOptions(options: GitHubClientOptions = {}): ResolvedOptions {
  // Use runtimeConfig if token not provided
  const config = options.token ? null : useRuntimeConfig()
  return {
    token: options.token ?? config?.githubToken ?? '',
    baseUrl: options.baseUrl ?? 'https://api.github.com',
  }
}

export interface PullRequest {
  number: number
  title: string
  body: string | null
  head: { sha: string, ref: string }
  base: { sha: string, ref: string }
  additions: number
  deletions: number
  changed_files: number
}

export interface PullRequestFile {
  filename: string
  status: 'added' | 'removed' | 'modified' | 'renamed'
  additions: number
  deletions: number
  patch?: string
}

export function createGitHubClient(options: GitHubClientOptions = {}) {
  const resolved = resolveOptions(options)

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${resolved.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${resolved.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`GitHub API error ${res.status}: ${error}`)
    }

    return res.json()
  }

  return {
    getPullRequest(owner: string, repo: string, prNumber: number) {
      return request<PullRequest>('GET', `/repos/${owner}/${repo}/pulls/${prNumber}`)
    },

    async getPullRequestDiff(owner: string, repo: string, prNumber: number) {
      const res = await fetch(`${resolved.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: {
          'Authorization': `Bearer ${resolved.token}`,
          'Accept': 'application/vnd.github.v3.diff',
        },
      })
      return res.text()
    },

    getPullRequestFiles(owner: string, repo: string, prNumber: number) {
      return request<PullRequestFile[]>('GET', `/repos/${owner}/${repo}/pulls/${prNumber}/files`)
    },

    createIssueComment(owner: string, repo: string, issueNumber: number, body: string) {
      return request<{ id: number }>('POST', `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, { body })
    },

    createReviewComment(owner: string, repo: string, prNumber: number, comment: {
      body: string
      commit_id: string
      path: string
      line?: number
      side?: 'LEFT' | 'RIGHT'
    }) {
      return request<{ id: number }>('POST', `/repos/${owner}/${repo}/pulls/${prNumber}/comments`, comment)
    },

    formatSuggestion(suggestedCode: string, explanation: string): string {
      return `${explanation}\n\n\`\`\`suggestion\n${suggestedCode}\n\`\`\``
    },
  }
}

export function parseRepoFullName(fullName: string): { owner: string, repo: string } {
  const parts = fullName.split('/')
  if (parts.length < 2) throw new Error(`Invalid repo full name: ${fullName}`)
  return { owner: parts[0]!, repo: parts[1]! }
}
