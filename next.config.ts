import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  // The integration test suite builds into its own folder so it never clobbers a running dev server.
  distDir: process.env.SECUREEXAM_ISOLATED_BUILD === "1" ? ".next-check" : ".next",
  // cacheComponents stays off: the server pages read the session and database per request.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
