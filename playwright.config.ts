import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "app.spec.ts",
  use: { baseURL: "http://127.0.0.1:4175" },
  webServer: {
    command: "npx vite --config tests/e2e/vite.config.ts --host 127.0.0.1 --port 4175",
    url: "http://127.0.0.1:4175/tests/e2e/demo.html",
    reuseExistingServer: false,
  },
});
