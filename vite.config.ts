import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "src/ui",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: false,
    rollupOptions: {
      input: "src/ui/panel.html",
    },
  },
});
