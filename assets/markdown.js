const escapeHtml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function parseDocument(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  const metadata = {};
  let body = source;

  if (match) {
    for (const line of match[1].split("\n")) {
      const separator = line.indexOf(":");
      if (separator === -1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value.slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
      }
      metadata[key] = value;
    }
    body = source.slice(match[0].length);
  }

  return { metadata, html: markdownToHtml(body) };
}

function inline(value) {
  let output = escapeHtml(value);
  output = output.replace(/`([^`]+)`/g, "<code>$1</code>");
  output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) =>
    `<img src="${src}" alt="${alt}" loading="lazy">`,
  );
  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  output = output.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const external = /^https?:\/\//.test(href);
    return `<a href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ""}>${label}</a>`;
  });
  return output;
}

function markdownToHtml(source) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const html = [];
  let paragraph = [];
  let listItems = [];
  let code = null;

  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;

    const roots = [];
    const stack = [];

    for (const token of listItems) {
      while (stack.length && token.indent < stack.at(-1).indent) stack.pop();

      let list = stack.at(-1);
      if (!list || token.indent > list.indent) {
        const nested = { type: token.type, indent: token.indent, items: [] };
        if (list?.items.length) list.items.at(-1).children.push(nested);
        else roots.push(nested);
        stack.push(nested);
        list = nested;
      } else if (token.type !== list.type) {
        stack.pop();
        const parent = stack.at(-1);
        const sibling = { type: token.type, indent: token.indent, items: [] };
        if (parent?.items.length) parent.items.at(-1).children.push(sibling);
        else roots.push(sibling);
        stack.push(sibling);
        list = sibling;
      }

      list.items.push({ text: token.text, children: [] });
    }

    const renderList = (list) =>
      `<${list.type}>${list.items
        .map((item) => `<li>${inline(item.text)}${item.children.map(renderList).join("")}</li>`)
        .join("")}</${list.type}>`;

    html.push(...roots.map(renderList));
    listItems = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (code) {
        html.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
        code = null;
      } else {
        code = { language: line.slice(3).trim(), lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      flushList();
      html.push("<hr>");
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const listItem = line.match(/^([ \t]*)([-*]|\d+\.)\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      const indent = [...listItem[1]].reduce((width, character) => width + (character === "\t" ? 4 : 1), 0);
      const type = listItem[2] === "-" || listItem[2] === "*" ? "ul" : "ol";
      listItems.push({ indent, type, text: listItem[3] });
      continue;
    }
    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      html.push(`<blockquote><p>${inline(quote[1])}</p></blockquote>`);
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}
