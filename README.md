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

| Requirement     | Link                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Node.js 22+     | [fnm](https://github.com/Schniz/fnm) (recommended)                   |
| pnpm            | [pnpm.io/installation](https://pnpm.io/installation)                 |
| Claude Code CLI | [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) |

### 1. Clone and Install

```bash
git clone https://github.com/onmax/pr-review-agent.git
cd pr-review-agent
pnpm install
```

### 2. Create GitHub App (Recommended)

Create a GitHub App for automatic webhook handling:

1. Go to [github.com/settings/apps/new](https://github.com/settings/apps/new)
2. Configure:
   - **Name**: `PR Review Agent` (or your choice)
   - **Homepage URL**: `https://github.com/onmax/pr-review-agent`
   - **Webhook URL**: `http://your-server:3000/webhook`
   - **Webhook secret**: generate with `openssl rand -hex 20`
3. Set permissions:
   - **Contents**: Read
   - **Issues**: Read & Write
   - **Pull requests**: Read
4. Subscribe to events: **Issue comment**
5. Click **Create GitHub App**
6. Generate and download a **Private Key**
7. Note the **App ID**
8. Install the app on your repos

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Webhook secret (same as in GitHub App settings)
NUXT_GITHUB_WEBHOOK_SECRET=your_webhook_secret

# GitHub App credentials
NUXT_GITHUB_APP_ID=123456
NUXT_GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# Optional: PAT for external repos (not installed with your app)
# NUXT_GITHUB_TOKEN=github_pat_xxx
```

### 4. Authenticate Claude CLI

```bash
claude login
```

Follow the browser prompts to authenticate with your Claude Code subscription.

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

| Agent             | Model  | Focus                                    |
| ----------------- | ------ | ---------------------------------------- |
| nuxt-reviewer     | Sonnet | Composables, server routes, h3 patterns  |
| vue-reviewer      | Sonnet | Composition API, props/emits, reactivity |
| security-reviewer | Opus   | OWASP, secrets, injection, auth gaps     |
| test-runner       | Haiku  | Run tests, report failures and coverage  |

### Prompt Engineering

The agent prompts follow Anthropic's Claude 4.x best practices:

- **Haiku**: Direct, fast prompts. No extended thinking.
- **Sonnet**: Explicit parallel tool calls. Multi-file context.
- **Opus**: Avoid "think" → use "evaluate/consider". Explicit code exploration. Minimal scope.

All prompts use XML tags for structure (`<task>`, `<output_format>`, `<parallel_tool_calls>`).

## Trigger

### Via GitHub App (automatic)

Comment `/review` on any PR in a repo where your app is installed. The agent will:

1. Post a "Starting PR review..." comment
2. Clone the PR branch
3. Launch parallel subagents
4. Aggregate findings (filter confidence < 80)
5. Post the review comment with linked code

### Via CLI (for external repos)

Trigger reviews on repos where your app isn't installed:

```bash
# With server running locally
./cli/index.mjs https://github.com/nuxt/nuxt/pull/123

# With remote server
PR_REVIEW_SERVER=https://your-server.com ./cli/index.mjs https://github.com/owner/repo/pull/456

# Or with --server flag
./cli/index.mjs https://github.com/owner/repo/pull/789 --server https://your-server.com
```

This uses the `/trigger` endpoint which falls back to PAT authentication.

## Environment Variables

| Variable                      | Required | Description                          |
| ----------------------------- | -------- | ------------------------------------ |
| `NUXT_GITHUB_WEBHOOK_SECRET`  | Yes      | Webhook secret (same in GitHub App)  |
| `NUXT_GITHUB_APP_ID`          | For App  | GitHub App ID                        |
| `NUXT_GITHUB_APP_PRIVATE_KEY` | For App  | GitHub App private key (PEM)         |
| `NUXT_GITHUB_TOKEN`           | For CLI  | PAT for external repos               |
| `NUXT_SECURITY_MODEL`         | No       | Model for security (default: opus)   |
| `NUXT_ANALYSIS_MODEL`         | No       | Model for analysis (default: sonnet) |
| `NUXT_UTILITY_MODEL`          | No       | Model for utility (default: haiku)   |

## License

MIT
