import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";


export default defineConfig([
    { files: ["**/*.{js,mjs,cjs,ts}"], plugins: { js }, extends: ["js/recommended"] },
    { files: ["**/*.{js,mjs,cjs,ts}"], languageOptions: { globals: globals.node } },
    tseslint.configs.recommended,
    tseslint.config({
        rules: { "@typescript-eslint/consistent-type-imports": "error"}
    }),
    {
        rules: {
            indent: ["error", 4, {
                SwitchCase: 1,
            }],
            "linebreak-style": ["error", "unix"],
            quotes: ["error", "double"],
            semi: ["error", "always"],
        },
    },
]);