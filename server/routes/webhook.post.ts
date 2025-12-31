import { z } from 'zod'

const IssueCommentSchema = z.object({
  action: z.literal('created'),
  comment: z.object({
    body: z.string(),
    user: z.object({ login: z.string() }),
  }),
  issue: z.object({
    number: z.number(),
    pull_request: z.object({}).optional(),
  }),
  repository: z.object({
    full_name: z.string(),
    clone_url: z.string(),
  }),
})

export default defineEventHandler(async (event) => {
  // 1. Validate HMAC signature
  const signature = getRequestHeader(event, 'x-hub-signature-256')
  const body = await readRawBody(event)

  if (!validateWebhookSignature(body, signature)) {
    throw createError({ statusCode: 401, message: 'Invalid webhook signature' })
  }

  // 2. Check event type
  const eventType = getRequestHeader(event, 'x-github-event')
  if (eventType !== 'issue_comment') {
    return { status: 'ignored', reason: 'not issue_comment event' }
  }

  // 3. Parse and validate payload
  const parsed = IssueCommentSchema.safeParse(JSON.parse(body!))
  if (!parsed.success) {
    return { status: 'ignored', reason: 'invalid payload schema' }
  }

  const payload = parsed.data

  // 4. Filter: must be PR comment
  if (!payload.issue.pull_request) {
    return { status: 'ignored', reason: 'not a PR comment' }
  }

  // 5. Filter: must start with /review
  const comment = payload.comment.body.trim()
  if (!comment.startsWith('/review')) {
    return { status: 'ignored', reason: 'not /review command' }
  }

  // 6. Spawn review process
  console.log(`[Webhook] Received /review for PR #${payload.issue.number} from @${payload.comment.user.login}`)

  spawnClaudeReview({
    repository: payload.repository,
    issue: payload.issue,
    comment: payload.comment,
  })

  return { status: 'queued', pr: payload.issue.number }
})
