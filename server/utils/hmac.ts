import { createHmac, timingSafeEqual } from 'node:crypto'

export function validateWebhookSignature(payload: string | undefined, signature: string | undefined): boolean {
  if (!payload || !signature) return false

  const config = useRuntimeConfig()
  const expected = `sha256=${createHmac('sha256', config.githubWebhookSecret).update(payload).digest('hex')}`

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  }
  catch {
    return false
  }
}
