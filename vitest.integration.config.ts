import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "codex-integration",
    environment: "node",
    include: ["tests/integration/**/*.{test,spec}.{ts,tsx}"],
  },
});
