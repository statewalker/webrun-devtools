import { defineConfig } from "vitest/config";

// Unit tests: plain Node with a fake of the chrome.* APIs (tests/fake-chrome.js).
// The end-to-end tests, which load the built extension into Chromium, have their own
// config (vitest.e2e.config.js, `pnpm test:e2e`).
export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    exclude: ["tests/e2e/**"],
  },
});
