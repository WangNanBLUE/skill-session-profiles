import { defineConfig } from "tsup";

const bundledDependencies = [
  "@modelcontextprotocol/sdk",
  "@modelcontextprotocol/ext-apps",
  "zod",
];

export default defineConfig([
  {
    entry: {
      "server/index": "src/server/index.ts",
      "hook/session-start": "src/hook/session-start.ts",
      "electron/main": "src/electron/main.ts",
    },
    format: ["esm"],
    bundle: true,
    splitting: false,
    noExternal: bundledDependencies,
    external: ["electron"],
    outDir: "dist",
    clean: false,
  },
  {
    entry: {
      preload: "src/electron/preload.ts",
    },
    format: ["cjs"],
    bundle: true,
    splitting: false,
    external: ["electron"],
    outDir: "dist/electron",
    outExtension: () => ({ js: ".cjs" }),
    clean: false,
  },
]);
