import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

export default [
  {
    files: [
      "src/components/**/*.{js,mjs,cjs,jsx}",
      "src/pages/**/*.{js,mjs,cjs,jsx}",
      "src/Layout.jsx",
    ],
    ignores: ["src/lib/**/*", "src/components/ui/**/*"],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      "no-unused-vars": "off",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
      // Spreading a shared config and then declaring `rules` replaces the
      // spread rules wholesale, so this was off everywhere despite the
      // `recommended` spread above. It is the one rule that catches an
      // identifier used but never imported, which shipped green twice: it
      // lives inside a template literal, so tests that never call the function
      // miss it, and the bundler does not resolve free names either.
      "no-undef": "error",
    },
  },
  {
    // src/lib was not linted at all. It holds the AI generation pipeline, the
    // validators and the failure log, which is where an unbound identifier is
    // most expensive and least visible.
    files: ["src/lib/**/*.{js,mjs,cjs,jsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "unused-imports": pluginUnusedImports },
    rules: {
      "no-undef": "error",
      "unused-imports/no-unused-imports": "error",
    },
  },
  {
    // Em dashes and en dashes are banned in every word a student or a buyer
    // reads. The only check used to be a grep of the built bundle, which
    // nothing runs automatically, so 34 of them piled up in static UI strings
    // before anyone counted again.
    //
    // Why lint and not a test: the test command does not build, so a test that
    // grepped dist/ would read a stale or missing bundle and pass while saying
    // nothing. This reads source, which is also why it matches on the AST and
    // not on text: a grep of src/ returns ~476 hits that are almost all code
    // comments, and comments do not ship. Matching Literal and TemplateElement
    // values skips comments entirely, and because the value is the resolved
    // one, a dash written as a unicode escape is caught like a pasted one.
    //
    // JSXText is here because a dash typed straight into markup is not a
    // Literal, and static markup is exactly where these accumulate.
    //
    // Every file under src, including the corners the rules above do not
    // reach, because shipped text does not respect the folder layout.
    files: ["src/**/*.{js,mjs,cjs,jsx}"],
    // Tests are the one place a dash is the point: several feed one in to prove
    // a stripper removes it, and a few sit in describe() titles. No test file
    // reaches the bundle, so nothing here is text anyone reads.
    ignores: ["src/**/*.test.{js,jsx}"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/[\\u2014\\u2013]/]",
          message:
            "No em dashes or en dashes in shipped text. Use a period, comma, colon or brackets. A hyphen between two numbers is fine.",
        },
        {
          selector: "TemplateElement[value.cooked=/[\\u2014\\u2013]/]",
          message:
            "No em dashes or en dashes in shipped text. Use a period, comma, colon or brackets. A hyphen between two numbers is fine.",
        },
        {
          selector: "JSXText[value=/[\\u2014\\u2013]/]",
          message:
            "No em dashes or en dashes in shipped text. Use a period, comma, colon or brackets. A hyphen between two numbers is fine.",
        },
      ],
    },
  },
];
