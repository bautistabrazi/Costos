import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
export default [
  {ignores:['dist','coverage','node_modules']},
  js.configs.recommended,
  {
    files:['**/*.{js,jsx}'],
    plugins:{'react-hooks':reactHooks,'react-refresh':reactRefresh},
    languageOptions:{ecmaVersion:2022,globals:globals.browser,parserOptions:{ecmaVersion:'latest',ecmaFeatures:{jsx:true},sourceType:'module'}},
    rules:{...reactHooks.configs.flat.recommended.rules,...reactRefresh.configs.vite.rules,'react-refresh/only-export-components':'off','react-hooks/set-state-in-effect':'off','no-unused-vars':['error',{varsIgnorePattern:'^[A-Z_]',argsIgnorePattern:'^_'}]}
  }
]
