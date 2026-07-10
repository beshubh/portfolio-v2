import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const adminHtml = await readFile(
  path.join(root, "dist-admin", "admin", "index.html"),
  "utf8",
);

assert.match(adminHtml, /<div id="admin-root"><\/div>/);
assert.doesNotMatch(adminHtml, /src\/admin\/main\.jsx/);
await assert.rejects(
  () => access(path.join(root, "dist-admin", "index.html")),
  { code: "ENOENT" },
  "The Worker artifact must not duplicate the public portfolio",
);
