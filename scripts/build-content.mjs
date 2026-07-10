import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const writings = path.join(root, "content", "writings");

function parseFrontmatter(source) {
  if (!source.startsWith("---\n")) return {};
  const end = source.indexOf("\n---\n", 4);
  if (end === -1) return {};

  return Object.fromEntries(
    source
      .slice(4, end)
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(":");
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (value.startsWith("[") && value.endsWith("]")) {
          value = value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
        }
        return [key, value];
      }),
  );
}

await mkdir(path.join(dist, "content", "writings"), { recursive: true });
await cp(path.join(root, "404.html"), path.join(dist, "404.html"));
await cp(path.join(root, "content", "pages"), path.join(dist, "content", "pages"), { recursive: true });
await cp(path.join(root, "content", "site.json"), path.join(dist, "content", "site.json"));

const posts = [];
for (const filename of await readdir(writings)) {
  if (!filename.endsWith(".md") || filename.startsWith("_")) continue;
  const source = await readFile(path.join(writings, filename), "utf8");
  const metadata = parseFrontmatter(source);
  if (metadata.status === "draft") continue;
  const slug = filename.replace(/\.md$/, "");
  posts.push({ slug, ...metadata });
  await cp(path.join(writings, filename), path.join(dist, "content", "writings", filename));
}

posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
await writeFile(path.join(dist, "content", "writings", "index.json"), `${JSON.stringify(posts, null, 2)}\n`);
await writeFile(path.join(dist, ".nojekyll"), "");

console.log(`Built ${posts.length} published writing${posts.length === 1 ? "" : "s"} into dist/`);
