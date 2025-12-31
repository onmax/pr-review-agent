import { consola } from 'consola'
import { z } from 'zod'
import { spawnClaudeReview } from '../utils/claude'

const TriggerSchema = z.object({
  prUrl: z.string().url(),
})

// Manual trigger endpoint for external repos (uses PAT fallback)
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = TriggerSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request. Provide { prUrl: "https://github.com/owner/repo/pull/123" }' })
  }

  // Parse PR URL: https://github.com/owner/repo/pull/123
  const match = parsed.data.prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) {
    throw createError({ statusCode: 400, message: 'Invalid PR URL format' })
  }

  const [, owner, repo, prNumber] = match as [string, string, string, string]

  consola.info(`Manual trigger for ${owner}/${repo}#${prNumber}`)

  // Spawn review without installationId - will use PAT fallback
  spawnClaudeReview({
    repository: {
      full_name: `${owner}/${repo}`,
      clone_url: `https://github.com/${owner}/${repo}.git`,
    },
    issue: { number: Number.parseInt(prNumber) },
    comment: { body: '/review', user: { login: 'manual-trigger' } },
    // No installationId - uses PAT fallback
  })

  return { status: 'started', pr: parsed.data.prUrl }
})
