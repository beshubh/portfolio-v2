# Shubham Kumar — portfolio

A dependency-free static portfolio designed for GitHub Pages. The interface is generated from Markdown content; page copy is not embedded in the HTML.

## Edit the homepage

Change `content/pages/about.md`. The `projects.md` file controls the Projects page.

## Add a writing

Copy `content/writings/_template.md` to `content/writings/your-post-slug.md`, complete the frontmatter, and change `status` to `published`.

Required frontmatter:

```yaml
---
title: Your post title
date: 2026-07-04
summary: One sentence shown on the writing index.
tags: [systems, reliability]
status: published
---
```

Push the Markdown change to `main`. The included GitHub Actions workflow builds the writing index and deploys the site, so generated files do not need to be committed.

## Run locally

```sh
npm run dev
```

Open `http://localhost:4173`. Use `npm run build` to generate the deployable `dist/` directory without starting a server.

## GitHub Pages setup

In the repository settings, open **Pages** and select **GitHub Actions** as the source. The workflow supports both user sites and repository subpaths because all asset and content URLs are relative.
