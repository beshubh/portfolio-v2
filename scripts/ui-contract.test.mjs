import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const styles = await readFile(path.join(root, "src", "styles.css"), "utf8");

assert.match(
  styles,
  /\.desktop-window\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/s,
  "Minimized windows must have an explicit author-level display rule; .desktop-window uses display:grid and otherwise overrides the browser's hidden default.",
);
