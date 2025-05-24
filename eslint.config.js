import eslint from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import qwik from "eslint-plugin-qwik";
import globals from "globals";

export default [
    // 기본 ESLint 권장 설정
    eslint.configs.recommended,

    // TypeScript 및 JSX 파일에 대한 설정
    {
        files: ["**/*.{ts,tsx,js,jsx}"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                project: ["./tsconfig.json"],
                ecmaVersion: 2021,
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
            },
        },
        plugins: {
            "@typescript-eslint": typescript,
            qwik: qwik,
        },
        rules: {
            // TypeScript 권장 규칙들
            ...typescript.configs.recommended.rules,

            // Qwik 권장 규칙들
            ...qwik.configs.recommended.rules,

            // 커스텀 규칙들 (기존 .eslintrc.cjs에서 가져옴)
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-inferrable-types": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-empty-interface": "off",
            "@typescript-eslint/no-namespace": "off",
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-this-alias": "off",
            "@typescript-eslint/ban-types": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "prefer-spread": "off",
            "no-case-declarations": "off",
            "no-console": "off",
            "@typescript-eslint/no-unused-vars": ["error"],
            "@typescript-eslint/consistent-type-imports": "warn",
            "@typescript-eslint/no-unnecessary-condition": "warn",
        },
    },

    // 무시할 파일들
    {
        ignores: [
            "dist/**",
            "server/**",
            "tmp/**",
            "node_modules/**",
            ".eslintrc.cjs",
            "*.config.js",
            "*.config.ts",
        ],
    },
]; 