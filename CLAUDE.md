# PR Review Agent

GitHub webhook server + Claude Code multi-agent PR review system.

## Setup

```bash
pnpm install
cp .env.example .env
# Edit .env with your secrets
```

## Environment Variables

- `NUXT_GITHUB_WEBHOOK_SECRET` - GitHub webhook secret
- `NUXT_GITHUB_TOKEN` - GitHub PAT with repo access
- `NUXT_SECURITY_MODEL` - Model for security reviews (default: opus)
- `NUXT_ANALYSIS_MODEL` - Model for analysis agents (default: sonnet)
- `NUXT_UTILITY_MODEL` - Model for utility tasks (default: haiku)

## Architecture

```
GitHub webhook (issue_comment)
         │
         ▼
server/routes/webhook.post.ts (HMAC + /review filter)
         │
         ▼
Claude Agent SDK query() with 9 agents
         │
         ▼
github-api agent posts review via REST API
```

## Agents

| Agent | Model Tier | Purpose |
|-------|------------|---------|
| git-validator | utility | Branch sanity check |
| context-explorer | analysis | Git blame for small PRs |
| security-reviewer | security | OWASP, secrets, auth |
| code-quality | analysis | DRY, complexity |
| test-analyzer | analysis | Run tests, coverage |
| performance | analysis | N+1, memory, bundle |
| documentation | utility | JSDoc, README |
| drawbacks-analyzer | analysis | Edge cases, risks |
| github-api | utility | POST review via API |

## Prompt Engineering (per Anthropic Claude 4.x best practices)

**Haiku (utility tier)**: Fast, direct prompts. XML tags for structure. Max 8000 output tokens.

**Sonnet (analysis tier)**: Explicit `<parallel_tool_calls>` instructions. Multi-file context. `<investigation>` blocks for code exploration.

**Opus (security tier)**: Avoid "think" → use "evaluate/consider/assess". Explicit `<code_exploration>` + `<minimal_scope>` to prevent overengineering. Thorough verification requirements.

All prompts use:
- `<task>` wrapper for main goal
- `<output_format>` for structured results
- Confidence >= 80 threshold
- Tell what TO DO (not what NOT to do)

## Development

```bash
pnpm dev
```

## Deployment

```bash
pnpm build
node .output/server/index.mjs
```

Or with systemd: see `systemd/pr-review.service`

## Trigger

Comment `/review` on any PR to trigger review.
