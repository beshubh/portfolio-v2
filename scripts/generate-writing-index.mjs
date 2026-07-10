import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const posts = [];
for (const filename of await readdir(writings)) {
  if (!filename.endsWith(".md") || filename.startsWith("_")) continue;
  const source = await readFile(path.join(writings, filename), "utf8");
  const metadata = parseFrontmatter(source);
  if (metadata.status === "draft") continue;
  posts.push({ slug: filename.replace(/\.md$/, ""), ...metadata });
}

posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
await writeFile(path.join(writings, "index.json"), `${JSON.stringify(posts, null, 2)}\n`);
console.log(`Indexed ${posts.length} published writing${posts.length === 1 ? "" : "s"}.`);
