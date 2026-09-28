import { defineConfig } from "vite";

export default defineConfig({
  // Relative output keeps the existing GitHub Pages/subdirectory deployment working.
  base: "./",
  build: {
    sourcemap: true,
  },
});
