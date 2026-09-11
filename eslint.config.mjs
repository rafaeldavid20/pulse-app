import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Los colores viven como tokens en `@theme` (src/app/globals.css) — un hex
// suelto en className vuelve a abrir la puerta al find-and-replace manual
// que este design system existe para evitar.
const HEX_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b/;

const noHexInClassName = {
  rules: {
    "no-hex-classname": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Disallow hardcoded #RRGGBB colors in className; use a design token utility (bg-surface, text-secondary, etc.) instead.",
        },
        schema: [],
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name.name !== "className" || !node.value) return;
            const text = context.sourceCode.getText(node.value);
            if (HEX_COLOR_PATTERN.test(text)) {
              context.report({
                node: node.value,
                message:
                  "No hardcodees colores hex en className. Usá un token de @theme (bg-surface, text-secondary, border-default, priority-*, etc).",
              });
            }
          },
        };
      },
    },
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { local: noHexInClassName },
    rules: { "local/no-hex-classname": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
