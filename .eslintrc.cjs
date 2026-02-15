module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script",
  },
  rules: {
    "no-undef": "error",
    "no-global-assign": "error",
    "no-implied-eval": "error",
  },
};
