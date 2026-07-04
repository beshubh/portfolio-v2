import assert from "node:assert/strict";
import { parseDocument } from "../assets/markdown.js";

const source = `- Parent item
    - First child
    - Second child
- Sibling item`;

const { html } = parseDocument(source);

assert.ok(
  html.includes(
    "<li>Parent item<ul><li>First child</li><li>Second child</li></ul></li>",
  ),
  `Expected child bullets to be nested inside the parent item. Received:\n${html}`,
);
assert.ok(
  html.includes("<li>Sibling item</li>"),
  `Expected the sibling item to remain at the root level. Received:\n${html}`,
);
assert.doesNotMatch(html, /<p>- (First|Second) child/);
