import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "src/**/*.{test,spec}.{ts,tsx}",
            "tests/**/*.{test,spec}.{ts,tsx}",
          ],
          exclude: ["src/ui/**", "tests/ui/**", "tests/e2e/**", "tests/electron/**"],
        },
      },
      {
        test: {
          name: "ui",
          environment: "jsdom",
          include: [
            "src/ui/**/*.{test,spec}.{ts,tsx}",
            "tests/ui/**/*.{test,spec}.{ts,tsx}",
          ],
        },
      },
    ],
  },
});
