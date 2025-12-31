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
webhook.post.ts (HMAC + /review filter)
         │
         ▼
runReview() → analyze changed files
         │
         ├─ getAgentsForFiles(files) → dynamic agent selection
         ├─ getSkillsForAgents(agents) → download only needed skills
         │
         ▼
Claude Code CLI with orchestrator prompt
         │
         ├─ Spawns 3-15 agents in parallel based on file patterns
         ├─ Aggregates findings, removes duplicates
         ├─ critic-agent validates before posting
         │
         ▼
gh CLI posts review comment
```

## Agent Catalog (20+ agents)

Dynamic spawning based on file patterns. Skills shared across agents.

### Always Spawn
| Agent | Model | Purpose |
|-------|-------|---------|
| security-reviewer | opus | OWASP, secrets, injection, auth |
| code-quality | sonnet | DRY, complexity, CLAUDE.md |

### Framework Agents (triggered by file patterns)
| Agent | Model | Triggers | Skills |
|-------|-------|----------|--------|
| nuxt-reviewer | sonnet | nuxt.config, server/**, app/** | nuxt, nuxt-modules |
| vue-reviewer | sonnet | *.vue, components/** | vue, reka-ui |
| api-reviewer | sonnet | server/api/**, routes/** | nuxt, ts-library |
| nuxthub-reviewer | sonnet | hub/**, drizzle/** | nuxthub |

### Domain Agents
| Agent | Model | Triggers |
|-------|-------|----------|
| auth-reviewer | opus | auth/**, middleware/**, session* |
| db-reviewer | sonnet | schema/**, migrations/** |
| a11y-reviewer | sonnet | *.vue (ARIA, keyboard) |
| i18n-reviewer | haiku | locales/**, $t( |

### Type & Quality
| Agent | Model | Triggers |
|-------|-------|----------|
| typescript-reviewer | sonnet | *.ts (complex types) |
| test-analyzer | haiku | *.test.*, __tests__/** |
| perf-reviewer | sonnet | (orchestrator-triggered) |

### Infrastructure
| Agent | Model | Triggers |
|-------|-------|----------|
| deps-reviewer | haiku | package.json, lockfiles |
| config-reviewer | haiku | *.config.ts, .env* |
| ci-reviewer | haiku | .github/**, Dockerfile |

### Utility
| Agent | Model | Purpose |
|-------|-------|---------|
| git-historian | haiku | Git blame, related PRs |
| impact-analyzer | sonnet | Cross-file dependencies |
| critic-agent | haiku | Validate findings before posting |
| github-api | haiku | Post review via gh CLI |
| repro-creator | sonnet | Create bug reproductions, push to ~/repros |

## Skills (shared resources)

Skills downloaded on-demand based on agents spawned:

| Skill | Used By |
|-------|---------|
| nuxt | nuxt-reviewer, api-reviewer, config-reviewer |
| vue | vue-reviewer, a11y-reviewer |
| nuxt-modules | nuxt-reviewer, api-reviewer |
| nuxthub | nuxthub-reviewer, db-reviewer |
| reka-ui | vue-reviewer, a11y-reviewer |
| ts-library | typescript-reviewer, api-reviewer |

## Prompt Engineering (Anthropic Claude 4.x best practices)

**Haiku (utility)**: Fast, direct. XML tags.

**Sonnet (analysis)**: `<parallel_tool_calls>`. Multi-file context.

**Opus (security)**: No "think" → use "evaluate/assess". `<code_exploration>` + `<minimal_scope>` + Chain of Verification.

All prompts:
- `<task>` wrapper
- `<output_format>` with confidence scores
- Confidence >= 80 threshold
- `<context_gathering>` for autonomous investigation

## Development

```bash
pnpm dev
```

## Deployment

```bash
pnpm build
node .output/server/index.mjs
```

## Trigger

Comment `/review` on any PR to trigger review.
