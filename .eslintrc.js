module.exports = {
  root: true,
  env: {
    node: true,
    'webextensions': true
  },
  'extends': [
    'plugin:vue/essential',
    '@vue/standard'
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-return-assign': 0,
    'indent': ['error', 2],
    'semi': ['error', 'always']
  },
  parserOptions: {
    parser: 'babel-eslint'
  },
  globals: {
    browser: true
  }
};
