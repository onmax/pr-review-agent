# PR Review Agent

A GitHub webhook server that triggers automated code reviews using Claude Code with parallel subagents. When a user comments `/review` on a pull request, the agent clones the repository, launches specialized reviewers in parallel, and posts findings as a GitHub comment.

## How It Works

```
GitHub webhook (issue_comment with /review)
                    │
                    ▼
    server/routes/webhook.post.ts
    (HMAC validation + command filter)
                    │
                    ▼
        AI SDK Claude Code Provider
        (orchestrator + parallel subagents)
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   nuxt-reviewer  vue-reviewer  security-reviewer
   (Sonnet)       (Sonnet)      (Opus)
        │           │           │
        └───────────┼───────────┘
                    ▼
           Aggregated findings
           (confidence >= 80)
                    │
                    ▼
         POST review comment via GitHub API
```

## Features

- **Parallel subagents** for Nuxt patterns, Vue best practices, security, and tests
- **Confidence scoring** filters noise (threshold: 80)
- **Full SHA code links** for direct navigation
- **HMAC signature validation** for webhook security
- **Fire-and-forget** processing with status comments

## Setup

### Prerequisites

- Node.js 18+
- Claude Code CLI authenticated (`claude login`)
- GitHub Personal Access Token with repo access
- GitHub webhook secret

### Installation

```bash
pnpm install
cp .env.example .env
```

Edit `.env` with your secrets:

```bash
NUXT_GITHUB_WEBHOOK_SECRET=your_webhook_secret
NUXT_GITHUB_TOKEN=ghp_your_token
```

### GitHub Webhook Configuration

1. Go to your repository **Settings** → **Webhooks** → **Add webhook**
2. Set **Payload URL** to your server endpoint (e.g., `https://your-server.com/webhook`)
3. Set **Content type** to `application/json`
4. Enter your **Secret**
5. Select **Let me select individual events** → check **Issue comments**
6. Save the webhook

## Development

Start the development server:

```bash
pnpm dev
```

The webhook endpoint is available at `http://localhost:3000/webhook`.

## Sandboxing

Claude Code runs with native [bubblewrap](https://github.com/containers/bubblewrap) sandbox on Linux. This provides OS-level isolation:

- Filesystem restrictions (only workdir accessible)
- Network filtering
- Process isolation
- All child processes inherit sandbox

### VPS Setup

```bash
# Install bubblewrap (required for sandbox)
sudo apt install bubblewrap

# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Authenticate Claude
claude login
```

The agent uses `--dangerously-skip-permissions` but bubblewrap still enforces OS-level restrictions.

## Deployment

### Node.js Direct

```bash
pnpm build
node .output/server/index.mjs
```

### Systemd Service

```bash
sudo cp systemd/pr-review.service /etc/systemd/system/
sudo systemctl enable pr-review
sudo systemctl start pr-review
```

## Architecture

### Subagents

| Agent             | Model  | Focus                                      |
| ----------------- | ------ | ------------------------------------------ |
| nuxt-reviewer     | Sonnet | Composables, server routes, h3 patterns    |
| vue-reviewer      | Sonnet | Composition API, props/emits, reactivity   |
| security-reviewer | Opus   | OWASP, secrets, injection, auth gaps       |
| test-runner       | Haiku  | Run tests, report failures and coverage    |

### Prompt Engineering

The agent prompts follow Anthropic's Claude 4.x best practices:

- **Haiku**: Direct, fast prompts. No extended thinking.
- **Sonnet**: Explicit parallel tool calls. Multi-file context.
- **Opus**: Avoid "think" → use "evaluate/consider". Explicit code exploration. Minimal scope.

All prompts use XML tags for structure (`<task>`, `<output_format>`, `<parallel_tool_calls>`).

## Trigger

Comment `/review` on any open pull request. The agent will:

1. Post a "Starting PR review..." comment
2. Clone the PR branch
3. Launch parallel subagents
4. Aggregate findings (filter confidence < 80)
5. Post the review comment with linked code

## Environment Variables

| Variable                    | Required | Description                        |
| --------------------------- | -------- | ---------------------------------- |
| `NUXT_GITHUB_WEBHOOK_SECRET` | Yes      | GitHub webhook secret              |
| `NUXT_GITHUB_TOKEN`          | Yes      | GitHub PAT with repo access        |
| `NUXT_SECURITY_MODEL`        | No       | Model for security (default: opus) |
| `NUXT_ANALYSIS_MODEL`        | No       | Model for analysis (default: sonnet) |
| `NUXT_UTILITY_MODEL`         | No       | Model for utility (default: haiku) |

## License

MIT
