import { defineConfig } from "vitest/config";

// End-to-end tests: the built extension in a headless Chromium (tests/e2e/extension-harness.js).
// Run with `pnpm test:e2e`, which builds first. Needs Playwright's Chromium installed
// (`pnpm exec playwright install chromium` where it is missing).
export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.e2e.test.js"],
    testTimeout: 60 * 1000,
    hookTimeout: 60 * 1000,
    fileParallelism: false,
  },
});
