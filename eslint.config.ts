import antfu from "@antfu/eslint-config";

const config = antfu({
  rules: {
    "no-console": "off",
    "no-alert": "off",
    "no-empty": "off",
    "no-use-before-define": ["off"],
    "no-unused-vars": "off",
    "eqeqeq": "off",
    "regexp/no-unused-capturing-group": "off",
    "unicorn/no-new-array": "off",
    "unicorn/prefer-number-properties": "off",
    "no-unmodified-loop-condition": "off",
    "antfu/top-level-function": "off",
    "array-callback-return": ["off"],
    "style/brace-style": ["error", "1tbs"],
    "style/arrow-parens": ["error", "always"],
    "style/operator-linebreak": "off",
    "style/indent-binary-ops": "off",
    "unused-imports/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "off",
    "perfectionist/sort-imports": ["off"],
    "node/prefer-global/process": ["off"],
    "ts/no-use-before-define": ["off"],
    "ts/array-callback-return": ["off"],
    "vue/custom-event-name-casing": "off",
    "vue/eqeqeq": "off",
    "vue/attributes-order": "off",
    "vue/html-closing-bracket-newline": "off",
    "vue/html-indent": "off",
    "vue/html-self-closing": "off",
    "vue/max-attributes-per-line": "off",
    "vue/multiline-html-element-content-newline": "off",
    "vue/no-template-shadow": "off",
    "vue/operator-linebreak": "off",
    "antfu/curly": "off",
    "antfu/if-newline": "off",
    "jsdoc/require-returns-check": "off",
    "jsdoc/require-returns-description": "off",
    "ts/no-namespace": ["warn", {
      allowDeclarations: true,
      allowDefinitionFiles: true,
    }],
    "vue/block-order": [
      "error",
      {
        order: [
          "template",
          "script:not([setup])",
          "script[setup]",
          "style:not([scoped])",
          "style[scoped]",
        ],
      },
    ],
    "vue/singleline-html-element-content-newline": ["off"],
    "vue/attribute-hyphenation": ["error", "always"],
    "vue/max-attributes-per-line": [
      "error",
      {
        singleline: {
          max: 10,
        },
        multiline: {
          max: 1,
        },
      },
    ],
    "vue/attributes-order": [
      "error",
      {
        order: [
          "GLOBAL",
          "DEFINITION",
          "LIST_RENDERING",
          ["UNIQUE", "SLOT"],
          "RENDER_MODIFIERS",
          "CONDITIONALS",
          "OTHER_DIRECTIVES",
          "ATTR_SHORTHAND_BOOL",
          "ATTR_STATIC",
          "TWO_WAY_BINDING",
          "ATTR_DYNAMIC",
          "EVENTS",
          "CONTENT",
        ],
        alphabetical: true,
      },
    ],
    "vue/html-self-closing": [
      "error",
      {
        html: {
          void: "never",
          normal: "never",
          component: "never",
        },
        svg: "always",
        math: "always",
      },
    ],
  },
  ignores: [
    "android/**",
    "package.json",
    "tsconfig.json",
    "tsconfig.*.json",
    "src/xyzw/**",
    "src/auto-imports.d.ts",
    "components.d.ts",
  ],
  stylistic: {
    indent: 2, // 4, or 'tab'
    quotes: "double", // or 'single'
    semi: true,
  },
  typescript: true,
  vue: {
    overrides: {
      "vue/no-empty-pattern": ["error", {
        allowObjectPatternsAsParameters: true,
      }],
    },
  },
});

export default config;
