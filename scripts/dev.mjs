import { watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const buildScript = path.join(root, "scripts", "build.mjs");
const port = Number(process.env.PORT || 4173);
const clients = new Set();

const reloadClient = `
<script>
  const reloadEvents = new EventSource('/__live_reload');
  reloadEvents.addEventListener('reload', () => location.reload());
</script>`;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

async function build() {
  const { stdout, stderr } = await execFileAsync(process.execPath, [buildScript], { cwd: root });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(dist, relative);
  return resolved.startsWith(`${dist}${path.sep}`) || resolved === dist ? resolved : null;
}

async function serve(request, response) {
  if (request.url === "/__live_reload") {
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
    });
    response.write("event: connected\ndata: ready\n\n");
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }

  let filename = resolveRequestPath(request.url);
  if (!filename) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
    return;
  }

  try {
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, "index.html");
    const extension = path.extname(filename);
    const body = await readFile(filename);

    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
    });
    response.end(
      extension === ".html"
        ? body.toString("utf8").replace("</body>", `${reloadClient}</body>`)
        : body,
    );
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

await build();

const server = createServer((request, response) => {
  serve(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) response.writeHead(500);
    response.end("Internal server error");
  });
});

server.listen(port, () => {
  console.log(`Portfolio dev server: http://localhost:${port}`);
  console.log("Watching content, assets, and page shell for changes…");
});

let rebuildTimer;
let rebuilding = false;
let rebuildQueued = false;

async function rebuild() {
  if (rebuilding) {
    rebuildQueued = true;
    return;
  }

  rebuilding = true;
  try {
    await build();
    for (const client of clients) client.write("event: reload\ndata: changed\n\n");
    console.log("Reloaded browser clients.");
  } catch (error) {
    console.error("Rebuild failed:", error.message);
  } finally {
    rebuilding = false;
    if (rebuildQueued) {
      rebuildQueued = false;
      await rebuild();
    }
  }
}

function queueRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(rebuild, 80);
}

const watchers = [
  watch(path.join(root, "assets"), { recursive: true }, queueRebuild),
  watch(path.join(root, "content"), { recursive: true }, queueRebuild),
  watch(path.join(root, "index.html"), queueRebuild),
  watch(path.join(root, "404.html"), queueRebuild),
];

function shutdown() {
  for (const watcher of watchers) watcher.close();
  for (const client of clients) client.end();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
