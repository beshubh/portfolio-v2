import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  publicDir: false,
  build: {
    assetsDir: "assets",
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        admin: path.resolve(root, "admin/index.html"),
        main: path.resolve(root, "index.html"),
      },
    },
  },
});
