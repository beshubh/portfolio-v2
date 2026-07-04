import { parseDocument } from "./markdown.js";

const content = document.querySelector("#content");
const params = new URLSearchParams(location.search);
const post = params.get("post");
const page = post ? "writing" : params.get("page") || "about";

document.querySelector("#year").textContent = new Date().getFullYear();
document.querySelectorAll("[data-route]").forEach((link) => {
  if (link.dataset.route === page) link.setAttribute("aria-current", "page");
});

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.text();
}

function safe(value = "") {
  const element = document.createElement("span");
  element.textContent = String(value);
  return element.innerHTML;
}

async function loadSiteConfig() {
  const response = await fetch("./content/site.json");
  if (!response.ok) return;
  const site = await response.json();
  document.querySelector("#site-name").textContent = site.name;
  document.querySelector("#footer-name").textContent = site.name;
  document.querySelector("#email-link").href = `mailto:${site.email}`;
  document.querySelector("#github-link").href = site.github;
}

async function renderMarkdown(url, article = false) {
  const source = await fetchText(url);
  const { metadata, html } = parseDocument(source);
  document.title = `${metadata.title || "Shubham Kumar"} — Shubham Kumar`;
  content.className = article ? "content article" : "content";
  content.innerHTML = article
    ? `<a class="back-link" href="./?page=writing">← All writing</a><header class="article-header"><h1>${safe(metadata.title)}</h1><p>${formatDate(metadata.date)}</p></header>${html}`
    : html;
  if (!article && page === "about") content.querySelector("p")?.classList.add("lede");
}

function formatDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

async function renderWritingIndex() {
  const response = await fetch("./content/writings/index.json");
  if (!response.ok) throw new Error("Could not load writing index");
  const posts = await response.json();
  document.title = "Writing — Shubham Kumar";
  content.innerHTML = `<h1 class="visually-hidden">Writing</h1><div class="writing-list">${posts
    .map(
      (item) => `<a class="writing-row" href="./?post=${encodeURIComponent(item.slug)}"><span><strong>${safe(item.title)}</strong>${item.summary ? `<small>${safe(item.summary)}</small>` : ""}</span><time datetime="${safe(item.date)}">${formatDate(item.date)}</time></a>`,
    )
    .join("")}</div>`;
}

async function render() {
  try {
    if (post) await renderMarkdown(`./content/writings/${encodeURIComponent(post)}.md`, true);
    else if (page === "writing") await renderWritingIndex();
    else if (["about", "projects"].includes(page)) await renderMarkdown(`./content/pages/${page}.md`);
    else throw new Error("Page not found");
  } catch (error) {
    content.innerHTML = `<h1>Not found</h1><p>The requested page could not be loaded.</p><p><a href="./">Return home</a></p>`;
    console.error(error);
  }
  content.focus({ preventScroll: true });
}

await loadSiteConfig();
render();
