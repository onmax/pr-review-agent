import type { Octokit } from 'octokit'
import { App } from 'octokit'

let app: InstanceType<typeof App> | null = null

export function getGitHubApp(): InstanceType<typeof App> {
  if (app)
    return app

  const config = useRuntimeConfig()

  if (!config.githubAppId || !config.githubAppPrivateKey) {
    throw new Error('GitHub App not configured. Set NUXT_GITHUB_APP_ID and NUXT_GITHUB_APP_PRIVATE_KEY')
  }

  app = new App({
    appId: config.githubAppId,
    privateKey: config.githubAppPrivateKey.replace(/\\n/g, '\n'),
    webhooks: { secret: config.githubWebhookSecret },
  })

  return app
}

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  return getGitHubApp().getInstallationOctokit(installationId) as unknown as Octokit
}

export async function getInstallationToken(installationId: number): Promise<string> {
  const octokit = await getInstallationOctokit(installationId)
  const { data } = await octokit.rest.apps.createInstallationAccessToken({ installation_id: installationId })
  return data.token
}

export function isGitHubAppConfigured(): boolean {
  const config = useRuntimeConfig()
  return Boolean(config.githubAppId && config.githubAppPrivateKey)
}
