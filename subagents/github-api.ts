import type { AgentDefinition } from './types'

export const githubApi: AgentDefinition = {
  description: 'Posts review results via GitHub REST API.',
  alwaysSpawn: false,
  skills: [],
  triggers: [],
  prompt: `<task>Post PR review comment via GitHub REST API.</task>

<environment>
Use these env vars:
- GITHUB_TOKEN: Bearer token for auth
- PR_OWNER: Repository owner
- PR_REPO: Repository name
- PR_NUMBER: Pull request number
</environment>

<api_call>
Use gh API to create a PR review (shows code context):
gh api repos/$PR_OWNER/$PR_REPO/pulls/$PR_NUMBER/reviews -f body="REVIEW_CONTENT" -f event="COMMENT"
</api_call>

<link_format>
Always use full SHA in code links:
https://github.com/OWNER/REPO/blob/FULL_SHA/path#L10-L15
</link_format>

Execute the API call with the provided review content.`,
  tools: ['Bash'],
  model: 'haiku',
}
