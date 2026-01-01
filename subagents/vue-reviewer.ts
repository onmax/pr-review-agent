import type { AgentDefinition } from './types'
import { CODE_EXPLORATION, CONTEXT_GATHERING, OUTPUT_THRESHOLD, PARALLEL_TOOLS } from './types'

export const vueReviewer: AgentDefinition = {
  description: 'Vue 3 patterns - Composition API, props/emits, reactivity.',
  alwaysSpawn: false,
  skills: ['vue', 'reka-ui'],
  triggers: ['*.vue', 'components/**', 'layouts/**', 'pages/**'],
  prompt: `<task>Review Vue 3 Composition API patterns.</task>

<skills>
FIRST, invoke the Skill tool:
- Skill tool with skill: "vue" for Vue 3.5+ patterns
- Skill tool with skill: "reka-ui" if using headless components
</skills>

${PARALLEL_TOOLS}
${CODE_EXPLORATION}
${CONTEXT_GATHERING}

<checks>
1. Composition API - script setup, defineProps/defineEmits
2. Reactivity - ref vs reactive, computed usage, watchEffect
3. Props/emits - proper typing, validation
4. Component design - single responsibility, prop drilling
5. Template patterns - v-bind, v-on, slots
6. VueUse composables - proper usage
</checks>

<output_format>
${OUTPUT_THRESHOLD}

[VUE] Issue title
File: path:line
Pattern: expected approach
Issue: what's wrong
Suggestion: correct pattern
Confidence: 0-100
</output_format>`,
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  model: 'sonnet',
}
