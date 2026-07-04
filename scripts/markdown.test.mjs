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

const richSource = `A ~~removed~~ idea.

![](https://example.com/diagram.png)

---`;

const { html: richHtml } = parseDocument(richSource);

assert.ok(richHtml.includes("A <s>removed</s> idea."));
assert.ok(
  richHtml.includes(
    '<img src="https://example.com/diagram.png" alt="" loading="lazy">',
  ),
);
assert.ok(richHtml.includes("<hr>"));
