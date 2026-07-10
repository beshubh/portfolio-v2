import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const adminBuild = mode === "admin";

  return {
    base: "./",
    publicDir: false,
    build: {
      assetsDir: "assets",
      emptyOutDir: true,
      outDir: adminBuild ? "dist-admin" : "dist",
      rollupOptions: {
        input: adminBuild
          ? { admin: path.resolve(root, "admin/index.html") }
          : { main: path.resolve(root, "index.html") },
      },
    },
  };
});
