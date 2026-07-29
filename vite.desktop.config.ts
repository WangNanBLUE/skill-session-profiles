import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/ui",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../../dist/desktop",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/ui/desktop.html",
    },
  },
});
