import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "../assets/markdown.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = await readFile(path.join(root, "src", "App.jsx"), "utf8");
const aboutSource = await readFile(path.join(root, "content", "pages", "about.md"), "utf8");

assert.doesNotMatch(
  appSource,
  /handleExternalLinkClick/,
  "External anchors must use native browser navigation instead of a scripted popup handler.",
);

const { html } = parseDocument("[SoloLearn](https://sololearn.com)");
assert.match(
  html,
  /<a href="https:\/\/sololearn\.com">SoloLearn<\/a>/,
  "External Markdown links must use ordinary same-tab navigation so embedded browsers cannot suppress them.",
);
assert.doesNotMatch(html, /target="_blank"/);

assert.doesNotMatch(
  appSource,
  /target="_blank"/,
  "Persistent external links must also avoid webview-blocked new-tab targets.",
);

for (const [, label, href] of aboutSource.matchAll(/\[([^\]]+)]\((https?:\/\/[^)]*)\)/g)) {
  assert.ok(
    new URL(href).hostname,
    `External link "${label}" must include a real hostname.`,
  );
}
