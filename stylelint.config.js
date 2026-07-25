/** @type {import('stylelint').Config} */
export default {
  ignoreFiles: [
    "**/dist/**",
    "**/www/assets/**",
    "**/android/**",
    "**/node_modules/**",
    "site/**",
    "src/portal/app/web/dist*/**",
  ],
  rules: {
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "tailwind",
          "apply",
          "layer",
          "theme",
          "source",
          "plugin",
          "custom-variant",
          "import",
        ],
      },
    ],
    "declaration-property-value-disallowed-list": [
      {
        "/.*/": [
          /--color-base-/i,
          /(?:^|[^\w-])--b[0-9]\b/,
          /\bdaisyui\b/i,
          /\bdata-theme\s*=/i,
          /\bbtn\s+btn-/i,
          /\bmodal-box\b/,
          /\binput-bordered\b/,
          /\btext-base-content\b/,
        ],
        "/^(background|background-color|border(-.*)?|color|fill|stroke)$/": [
          /^var\(--(?!sat|sar|sab|sal|app-bottom-nav-h|radius)/,
        ],
      },
      {
        severity: "error",
        message:
          "CSS 样式违规：禁止 DaisyUI 遗留 token；主题色请用 Tailwind utility 或 @apply，勿写 var(--*)（safe-area 变量除外）",
      },
    ],
  },
};
