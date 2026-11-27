import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    // Frontend unit tests (tests/unit) and backend unit + HTTP integration tests (src/server/tests).
    include: ["tests/unit/**/*.test.ts", "src/server/tests/**/*.test.ts"],
    environment: "node", testTimeout: 60_000, hookTimeout: 90_000, // dev server compiles routes on first hit
  },
});
