import { FlatCompat } from "@eslint/eslintrc";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// pnpm does not hoist eslint-config-next's plugins, so resolve them from that package's own folder.
const nextConfigDirectory = dirname(createRequire(import.meta.url).resolve("eslint-config-next"));
const compat = new FlatCompat({
  baseDirectory: fileURLToPath(new URL(".", import.meta.url)),
  resolvePluginsRelativeTo: nextConfigDirectory,
});

const config = [
  { ignores: [".next/**", ".next-check/**", "next-env.d.ts", "node_modules/**", "public/models/vision/**", ".agents/**", ".claude/**", ".cursor/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
