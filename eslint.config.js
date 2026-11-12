// Lint do frontend: regras recomendadas do ESLint, de React e dos hooks.
// A formatação fica com o Prettier (eslint-config-prettier desliga as regras de estilo).
import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/', 'public/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    settings: { react: { version: 'detect' } },
    plugins: { ...react.configs.flat.recommended.plugins, 'react-hooks': reactHooks },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // React 17+ não precisa importar React em cada arquivo JSX.
      'react/react-in-jsx-scope': 'off',
      // Projeto em JavaScript sem PropTypes; os contratos estão nos comentários dos componentes.
      'react/prop-types': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['test/**/*.js', 'e2e/**/*.mjs', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // O levantamento roda trechos dentro do navegador (page.evaluate).
    files: ['e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
]
