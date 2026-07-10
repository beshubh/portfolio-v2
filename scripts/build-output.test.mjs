import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function assertExactCopy(relativePath) {
  const [source, built] = await Promise.all([
    readFile(path.join(root, relativePath)),
    readFile(path.join(root, "dist", relativePath)),
  ]);
  assert.deepEqual(built, source, `${relativePath} must be copied without changing its contents`);
}

const writingIndex = JSON.parse(
  await readFile(path.join(root, "content", "writings", "index.json"), "utf8"),
);

assert.equal(writingIndex.length, 4, "Expected all four published writings in the generated index");

await Promise.all([
  assertExactCopy("404.html"),
  assertExactCopy("content/site.json"),
  assertExactCopy("content/pages/about.md"),
  assertExactCopy("content/pages/projects.md"),
  assertExactCopy("content/writings/index.json"),
  ...writingIndex.map((post) => assertExactCopy(`content/writings/${post.slug}.md`)),
]);

const builtHtml = await readFile(path.join(root, "dist", "index.html"), "utf8");
assert.match(builtHtml, /<div id="root"><\/div>/);
assert.doesNotMatch(builtHtml, /src\/main\.jsx/);

const builtAdminHtml = await readFile(path.join(root, "dist", "admin", "index.html"), "utf8");
assert.match(builtAdminHtml, /<div id="admin-root"><\/div>/);
assert.doesNotMatch(builtAdminHtml, /src\/admin\/main\.jsx/);
