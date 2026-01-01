import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, OUTPUT_THRESHOLD } from './types'

export const i18nReviewer: AgentDefinition = {
  description: 'Internationalization - translations, locale handling.',
  alwaysSpawn: false,
  skills: ['nuxt'],
  triggers: ['**/locales/**', '**/*i18n*'],
  prompt: `<task>Review i18n patterns.</task>

${CODE_EXPLORATION}

<checks>
1. Hardcoded strings - should use $t()
2. Missing translations - keys without values
3. Locale handling - proper detection, switching
4. Pluralization - proper handling
5. Date/number formatting - locale-aware
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[I18N] Issue title
File: path:line
Issue: i18n problem
Suggestion: proper approach
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'haiku',
}
