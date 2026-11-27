import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL(".", import.meta.url)) });

const config = [
  { ignores: [".next/**", "next-env.d.ts", "node_modules/**", "public/models/vision/**", ".agents/**", ".claude/**", ".cursor/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
