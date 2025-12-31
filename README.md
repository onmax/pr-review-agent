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

| Requirement | Link |
|-------------|------|
| Node.js 22+ | [fnm](https://github.com/Schniz/fnm) (recommended) |
| pnpm | [pnpm.io/installation](https://pnpm.io/installation) |
| Claude Code CLI | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) |
| GitHub PAT | [Create token](https://github.com/settings/tokens/new) (needs `repo` scope) |

### 1. Clone and Install

```bash
git clone https://github.com/onmax/pr-review-agent.git
cd pr-review-agent
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Generate with: openssl rand -hex 20
NUXT_GITHUB_WEBHOOK_SECRET=your_webhook_secret

# GitHub PAT with 'repo' scope
# https://github.com/settings/tokens/new
NUXT_GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Repos allowed to trigger reviews (comma-separated)
NUXT_ALLOWED_REPOS=owner/repo1,owner/repo2
```

### 3. Authenticate Claude CLI

```bash
claude login
```

Follow the browser prompts to authenticate with your Claude Code subscription.

### 4. Configure GitHub Webhook

For each repository in `NUXT_ALLOWED_REPOS`:

1. Navigate to **Settings** → **Webhooks** → [**Add webhook**](https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks)
2. Set **Payload URL** to `http://your-server:3000/webhook`
3. Set **Content type** to `application/json`
4. Enter the same **Secret** as `NUXT_GITHUB_WEBHOOK_SECRET`
5. Under **Which events?**, select **Let me select individual events**
6. Check only **Issue comments**
7. Click **Add webhook**

## Development

```bash
pnpm dev
```

The webhook endpoint is available at `http://localhost:3000/webhook`.

## Production Deployment

### Quick Start

```bash
pnpm build
node .output/server/index.mjs
```

### Systemd Service (Recommended)

For production, run the agent as a dedicated service user with systemd.

#### 1. Create Service User

```bash
sudo useradd -r -m -s /bin/bash srvx
sudo -u srvx bash
```

#### 2. Install Dependencies (as srvx user)

```bash
# Install fnm (Node.js version manager)
curl -fsSL https://fnm.vercel.app/install | bash
source ~/.bashrc

# Install Node.js and pnpm
fnm install 22
fnm use 22
corepack enable
corepack prepare pnpm@latest --activate

# Install Claude CLI
npm install -g @anthropic-ai/claude-code
claude login
```

#### 3. Clone and Build

```bash
cd ~
git clone https://github.com/onmax/pr-review-agent.git
cd pr-review-agent
pnpm install
pnpm build
cp .env.example .env
# Edit .env with your secrets
```

#### 4. Create systemd Service

Exit the srvx shell and create the service file:

```bash
exit

sudo tee /etc/systemd/system/pr-review.service << 'EOF'
[Unit]
Description=PR Review Agent
After=network.target

[Service]
Type=simple
User=srvx
WorkingDirectory=/home/srvx/pr-review-agent
Environment=PATH=/home/srvx/.local/share/fnm/node-versions/v22.21.1/installation/bin:/usr/bin
EnvironmentFile=/home/srvx/pr-review-agent/.env
ExecStart=/home/srvx/.local/share/fnm/node-versions/v22.21.1/installation/bin/node .output/server/index.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

#### 5. Enable and Start

```bash
sudo systemctl daemon-reload
sudo systemctl enable pr-review
sudo systemctl start pr-review
```

#### 6. View Logs

```bash
sudo journalctl -u pr-review -f
```

## Sandboxing

Claude Code runs with native [bubblewrap](https://github.com/containers/bubblewrap) sandbox on Linux:

- Filesystem restrictions (only workdir accessible)
- Network filtering
- Process isolation
- All child processes inherit sandbox

```bash
# Install bubblewrap (Ubuntu/Debian)
sudo apt install bubblewrap
```

The agent uses `--dangerously-skip-permissions` but bubblewrap enforces OS-level restrictions.

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
