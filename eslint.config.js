// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint"; // typescript-eslint 임포트
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

const isProduction = process.env.NODE_ENV === "production";
const isRelease = process.env.RELEASE === "true";

export default tseslint.config(
  // 1. 전역적으로 무시할 파일 및 폴더 설정
  { ignores: ["dist", "node_modules", "coverage", "eslint.config.js"] },

  // 2. 기본 JavaScript 및 TypeScript 규칙 적용
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 서버 파일 전용 설정 추가
  {
    files: ["server/**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // 3. React 관련 설정 (tsx 파일 대상)
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        // tsx(jsx) 활성화는 typescript-eslint가 자동으로 처리합니다.
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // JSX Transform을 사용하므로 불필요
      "react/prop-types": "off", // TypeScript에서 타입을 검사하므로 불필요
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // 4. 프로젝트 전반에 적용할 커스텀 규칙 및 환경별 규칙
  {
    rules: {
      // 기존 커스텀 규칙 유지
      quotes: ["error", "double"],
      semi: ["error", "always"],
      camelcase: ["error", { properties: "always" }],
      "comma-spacing": ["error", { before: false, after: true }],
      "space-infix-ops": "error",
      indent: ["error", 2],
      "max-statements-per-line": ["error", { max: 1 }],
      "new-cap": ["error", { capIsNewExceptions: ["Router"] }],

      // 환경별 규칙
      "no-console": isRelease ? "error" : isProduction ? "warn" : "off",
      "no-debugger": isRelease ? "error" : "warn",

      // no-unused-vars 규칙은 TypeScript용으로 교체
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": isProduction
        ? ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }]
        : [
            "warn",
            {
              varsIgnorePattern: "^[A-Z_]|^(temp|test|dummy)",
              argsIgnorePattern: "^_",
            },
          ],

      // Production 전용 규칙
      ...(isProduction && {
        "prefer-const": "error",
        "no-var": "error",
        "object-shorthand": "error",
        "no-multiple-empty-lines": ["error", { max: 2 }],
      }),
    },
  }
);
