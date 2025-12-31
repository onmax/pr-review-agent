#!/usr/bin/env node
import { parseArgs } from 'node:util'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    server: { type: 'string', short: 's', default: process.env.PR_REVIEW_SERVER || 'http://localhost:3000' },
    help: { type: 'boolean', short: 'h' },
  },
})

if (values.help || positionals.length === 0) {
  console.log(`
Usage: pr-review <github-pr-url> [options]

Options:
  -s, --server <url>  Server URL (default: $PR_REVIEW_SERVER or http://localhost:3000)
  -h, --help          Show this help

Examples:
  pr-review https://github.com/nuxt/nuxt/pull/123
  pr-review https://github.com/owner/repo/pull/456 --server https://my-server.com
  PR_REVIEW_SERVER=https://my-server.com pr-review https://github.com/owner/repo/pull/789
`)
  process.exit(0)
}

const prUrl = positionals[0]
if (!prUrl?.includes('github.com') || !prUrl.includes('/pull/')) {
  console.error('Error: Invalid PR URL. Expected format: https://github.com/owner/repo/pull/123')
  process.exit(1)
}

const serverUrl = values.server

console.log(`Triggering review for ${prUrl}...`)

try {
  const res = await fetch(`${serverUrl}/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prUrl }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    console.error(`Error: ${error.message || 'Request failed'}`)
    process.exit(1)
  }

  const data = await res.json()
  console.log(`✓ Review started for ${data.pr}`)
}
catch {
  console.error(`Error: Failed to connect to ${serverUrl}`)
  console.error(`Make sure the server is running and accessible.`)
  process.exit(1)
}
