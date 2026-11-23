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
  { files: ['src/**/*.js', 'reels/**/*.js', 'scripts/templates/*.js', 'scripts/site-fit.js', 'scripts/site-press.js', 'service/app-bridge.js', 'site/js/*.js', 'bottle/bottle.js', 'bottle/bottle-ui.mjs', 'bottle/admin.mjs'], languageOptions: { globals: globals.browser } },
  { files: ['site/js/sw.js'], languageOptions: { sourceType: 'script', globals: globals.serviceworker } },   // the service worker: not a module
  { files: ['bottle/bottle.js'], languageOptions: { sourceType: 'script' } },   // the button: a plain script, so any page can load it
  { files: ['scripts/**/*.mjs', 'service/**/*.mjs', 'bottle/server.mjs', 'bottle/sites.mjs', 'bottle/mail.mjs', 'bottle/bottles.mjs', 'bottle/test/*.js', 'test/**/*.js', 'eslint.config.js'], languageOptions: { globals: globals.node } }
];
