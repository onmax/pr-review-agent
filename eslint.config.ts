import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'app',
  pnpm: true,
  formatters: true,
  ignores: ['.claude/**'],
  rules: {
    'node/prefer-global/process': 'off',
    'node/prefer-global/buffer': 'off',
  },
})
