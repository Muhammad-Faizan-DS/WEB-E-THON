import { type NextConfig } from "next";

const config: NextConfig = {
  outputFileTracingRoot: __dirname,
  distDir: process.env.SECUREEXAM_ISOLATED_BUILD === "1" ? ".next-check" : ".next",
};

export default config;
