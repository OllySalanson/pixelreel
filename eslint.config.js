import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', '.venv/', 'models/', 'plugins/pixel-reel/skills/'] },   // the plugin's skill is made by npm run skill
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart']
    }
  },
  { files: ['src/**/*.js', 'reels/**/*.js', 'scripts/templates/*.js', 'service/app-bridge.js'], languageOptions: { globals: globals.browser } },
  { files: ['scripts/**/*.mjs', 'service/**/*.mjs', 'test/**/*.js', 'eslint.config.js'], languageOptions: { globals: globals.node } }
];
