import { defineConfig, globalIgnores } from "eslint/config";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import unicorn from 'eslint-plugin-unicorn';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores(["**/dist", "**/node_modules"]), {
    extends: compat.extends("plugin:@typescript-eslint/recommended"),

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2020,
        sourceType: "module",

        parserOptions: {
            allowImportExportEverywhere: true,

            ecmaFeatures: {
                impliedStrict: true,
            },
        },
    },

    rules: {
        "no-var": "error",
        "prefer-const": "error",
        "node/no-unsupported-features/es-syntax": "off",
        "node/no-missing-import": "off",
    },
}]);