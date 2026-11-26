export default [
  {
    ignores: ["node_modules/**", "dist/**"],
    rules: {}
  },
  {
    files: ["src/server.js"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly"
      }
    },
    rules: {
      "no-undef": "error"
    }
  }
];
