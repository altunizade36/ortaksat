// ESLint 10 düz yapılandırma (eski .eslintrc.json'un yerine).
// Amaç: derleyicinin (tsc) yakalamadığı ÇALIŞMA ZAMANI hatalarını yakalamak — biçim kuralı yok.
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**", "dist-web/**", "dist-check-*/**", "audit/**", "android/**", "ios/**", ".expo/**", ".vercel/**",
      "scripts/**", "supabase/**", "public/**", "*.config.js", "*.config.mjs"
    ]
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } }
    },
    // Kodda kasıtlı "exhaustive-deps" istisna yorumları var; o kural açık olmadığı için "kullanılmayan istisna" uyarısı verme.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Erken return'den SONRA hook → React #310 → sayfa çöker (bkz. listing/[id] olayı). Asla gevşetme.
      "react-hooks/rules-of-hooks": "error",
      // tsc'nin görmediği mantık hataları:
      "no-async-promise-executor": "error",
      "no-compare-neg-zero": "error",
      "no-cond-assign": ["error", "except-parens"],
      "no-constant-binary-expression": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-loss-of-precision": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-sparse-arrays": "error",
      "no-unreachable-loop": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",
      "no-unsafe-optional-chaining": "error",
      "no-useless-backreference": "error",
      "use-isnan": "error",
      "valid-typeof": "error"
    }
  }
];
