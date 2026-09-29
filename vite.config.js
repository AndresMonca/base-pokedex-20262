import { defineConfig } from "vite";

const localOrigin = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

export default defineConfig({
  // Relative output keeps the GitHub Pages subdirectory deployment portable.
  base: "./",
  server: {
    cors: { origin: localOrigin },
  },
  preview: {
    cors: { origin: localOrigin },
  },
  build: {
    // Source maps are unnecessary in the submitted static deployment.
    sourcemap: false,
  },
});
