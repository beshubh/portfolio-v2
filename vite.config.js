import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: false,
  build: {
    assetsDir: "assets",
    emptyOutDir: true,
    outDir: "dist",
  },
});
