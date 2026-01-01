import type { AgentDefinition } from './types'
import { a11yReviewer } from './a11y-reviewer'
import { apiReviewer } from './api-reviewer'
import { authReviewer } from './auth-reviewer'
import { breakingChange } from './breaking-change'
import { ciReviewer } from './ci-reviewer'
import { codeQuality } from './code-quality'
import { configReviewer } from './config-reviewer'
import { criticAgent } from './critic-agent'
import { dbReviewer } from './db-reviewer'
import { depsReviewer } from './deps-reviewer'
import { docChecker } from './doc-checker'
import { drawbacksAnalyzer } from './drawbacks-analyzer'
import { gitHistorian } from './git-historian'
import { gitValidator } from './git-validator'
import { githubApi } from './github-api'
import { i18nReviewer } from './i18n-reviewer'
import { impactAnalyzer } from './impact-analyzer'
import { nuxtReviewer } from './nuxt-reviewer'
import { nuxthubReviewer } from './nuxthub-reviewer'
import { perfReviewer } from './perf-reviewer'
import { reproCreator } from './repro-creator'
import { securityReviewer } from './security-reviewer'
import { testAnalyzer } from './test-analyzer'
import { typescriptReviewer } from './typescript-reviewer'
import { vueReviewer } from './vue-reviewer'

export type { AgentDefinition }
export * from './types'

export function getAgentCatalog(): Record<string, AgentDefinition> {
  return {
    'security-reviewer': securityReviewer,
    'code-quality': codeQuality,
    'repro-creator': reproCreator,
    'nuxt-reviewer': nuxtReviewer,
    'vue-reviewer': vueReviewer,
    'api-reviewer': apiReviewer,
    'nuxthub-reviewer': nuxthubReviewer,
    'auth-reviewer': authReviewer,
    'db-reviewer': dbReviewer,
    'a11y-reviewer': a11yReviewer,
    'i18n-reviewer': i18nReviewer,
    'typescript-reviewer': typescriptReviewer,
    'test-analyzer': testAnalyzer,
    'perf-reviewer': perfReviewer,
    'deps-reviewer': depsReviewer,
    'config-reviewer': configReviewer,
    'ci-reviewer': ciReviewer,
    'doc-checker': docChecker,
    'breaking-change': breakingChange,
    'git-historian': gitHistorian,
    'impact-analyzer': impactAnalyzer,
    'git-validator': gitValidator,
    'drawbacks-analyzer': drawbacksAnalyzer,
    'critic-agent': criticAgent,
    'github-api': githubApi,
  }
}

/** Get agents that should be spawned for given file patterns. */
export function getAgentsForFiles(files: string[]): string[] {
  const catalog = getAgentCatalog()
  const agentsToSpawn = new Set<string>()

  for (const [name, agent] of Object.entries(catalog)) {
    if (agent.alwaysSpawn) agentsToSpawn.add(name)
  }

  for (const file of files) {
    for (const [name, agent] of Object.entries(catalog)) {
      if (!agent.triggers?.length) continue
      for (const trigger of agent.triggers) {
        if (matchesTrigger(file, trigger)) {
          agentsToSpawn.add(name)
          break
        }
      }
    }
  }

  return Array.from(agentsToSpawn)
}

function matchesTrigger(file: string, pattern: string): boolean {
  if (pattern.startsWith('!')) return !matchesTrigger(file, pattern.slice(1))
  if (pattern.includes('**')) {
    const regex = new RegExp(`^${pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')}$`)
    return regex.test(file)
  }
  if (pattern.includes('*')) {
    const regex = new RegExp(`^${pattern.replace(/\*/g, '[^/]*')}$`)
    return regex.test(file)
  }
  return file.includes(pattern)
}

/** Get skills needed for a set of agents. */
export function getSkillsForAgents(agentNames: string[]): string[] {
  const catalog = getAgentCatalog()
  const skills = new Set<string>()

  for (const name of agentNames) {
    const agent = catalog[name]
    if (agent?.skills) {
      for (const skill of agent.skills) skills.add(skill)
    }
  }

  return Array.from(skills)
}
