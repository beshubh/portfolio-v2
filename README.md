# Shubham Kumar — portfolio

A React portfolio designed for GitHub Pages and built with Vite. The ShubhOS interface loads its page and article copy from Markdown, so content remains separate from the application shell.

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

Commit and push the Markdown change to `main`, then publish the generated site with:

```sh
npm run deploy
```

The deploy command builds the React app and writing index, then pushes only the generated site to the `gh-pages` branch. Generated files do not need to be committed to `main`.

## Run locally

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. Use `npm run build` to generate the deployable `dist/` directory without starting a server, or `npm run preview` to serve the production build locally.

Vite watches the React source, CSS, Markdown content, and page shell. The writing index is regenerated before both development and production builds.

## Verify

```sh
npm test
npm run test:build
```

The build-output check confirms that the published Markdown and site configuration are copied into `dist/` without content changes.

## GitHub Pages

Pages is served from the root of the `gh-pages` branch. The site supports both user sites and repository subpaths because all asset and content URLs are relative.
