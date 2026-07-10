import assert from "node:assert/strict";
import { createWorker } from "../worker/index.js";

const env = {
  ALLOWED_GITHUB_LOGIN: "beshubh",
  FRONTEND_ORIGIN: "https://beshubh.github.io",
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  REPO_NAME: "beshubh.github.io",
  REPO_OWNER: "beshubh",
  SESSION_SECRET: "test-session-secret",
};

const worker = createWorker();
const response = await worker.fetch(
  new Request("https://admin.example/api/session"),
  env,
);

assert.equal(response.status, 401);
assert.deepEqual(await response.json(), { authenticated: false });

const loginWorker = createWorker({
  randomToken: () => "fixed-oauth-state",
});
const loginResponse = await loginWorker.fetch(
  new Request("https://admin.example/auth/login"),
  env,
);
const authorizationUrl = new URL(loginResponse.headers.get("Location"));

assert.equal(loginResponse.status, 302);
assert.equal(authorizationUrl.origin, "https://github.com");
assert.equal(authorizationUrl.pathname, "/login/oauth/authorize");
assert.equal(authorizationUrl.searchParams.get("client_id"), env.GITHUB_CLIENT_ID);
assert.equal(authorizationUrl.searchParams.get("redirect_uri"), "https://admin.example/auth/callback");
assert.equal(authorizationUrl.searchParams.get("scope"), "public_repo");
assert.equal(authorizationUrl.searchParams.get("state"), "fixed-oauth-state");
assert.match(
  loginResponse.headers.get("Set-Cookie"),
  /__Host-shubh_oauth_state=fixed-oauth-state; Path=\/; Max-Age=600; HttpOnly; Secure; SameSite=Lax/,
);

const githubRequests = [];
const authenticatedWorker = createWorker({
  now: () => Date.parse("2026-07-10T10:00:00Z"),
  githubFetch: async (request, init) => {
    const url = typeof request === "string" ? request : request.url;
    githubRequests.push({ url, init });
    if (url === "https://github.com/login/oauth/access_token") {
      return Response.json({ access_token: "github-user-token" });
    }
    if (url === "https://api.github.com/user") {
      return Response.json({ login: "beshubh" });
    }
    if (url.includes("/repos/beshubh/beshubh.github.io/contents/content/writings/shipping-queues-safely.md")) {
      if (!init?.method || init.method === "GET") {
        return Response.json({ message: "Not Found" }, { status: 404 });
      }
      if (init.method === "PUT") {
        return Response.json(
          {
            content: { html_url: "https://github.com/beshubh/beshubh.github.io/blob/main/content/writings/shipping-queues-safely.md" },
            commit: { html_url: "https://github.com/beshubh/beshubh.github.io/commit/abc123" },
          },
          { status: 201 },
        );
      }
    }
    throw new Error(`Unexpected GitHub request: ${url}`);
  },
});
const callbackResponse = await authenticatedWorker.fetch(
  new Request("https://admin.example/auth/callback?code=oauth-code&state=fixed-oauth-state", {
    headers: { Cookie: "__Host-shubh_oauth_state=fixed-oauth-state" },
  }),
  env,
);

assert.equal(callbackResponse.status, 302);
assert.equal(callbackResponse.headers.get("Location"), "https://admin.example/admin/");
assert.match(callbackResponse.headers.get("Set-Cookie"), /__Host-shubh_admin=/);
assert.equal(githubRequests.length, 2);

const sessionCookie = callbackResponse.headers
  .get("Set-Cookie")
  .match(/__Host-shubh_admin=([^;]+)/)[1];
const sessionResponse = await authenticatedWorker.fetch(
  new Request("https://admin.example/api/session", {
    headers: { Cookie: `__Host-shubh_admin=${sessionCookie}` },
  }),
  env,
);

assert.equal(sessionResponse.status, 200);
assert.deepEqual(await sessionResponse.json(), {
  authenticated: true,
  login: "beshubh",
});

const publishResponse = await authenticatedWorker.fetch(
  new Request("https://admin.example/api/publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__Host-shubh_admin=${sessionCookie}`,
      Origin: "https://admin.example",
    },
    body: JSON.stringify({
      title: "Shipping queues safely",
      date: "2026-07-10",
      summary: "What failed and what changed.",
      tags: ["reliability", "celery"],
      slug: "shipping-queues-safely",
      body: "# First section\n\nReal body.",
    }),
  }),
  env,
);

assert.equal(publishResponse.status, 201);
assert.deepEqual(await publishResponse.json(), {
  articleUrl: "https://beshubh.github.io/?post=shipping-queues-safely",
  commitUrl: "https://github.com/beshubh/beshubh.github.io/commit/abc123",
  fileUrl: "https://github.com/beshubh/beshubh.github.io/blob/main/content/writings/shipping-queues-safely.md",
});

const putRequest = githubRequests.find(({ init }) => init?.method === "PUT");
assert.ok(putRequest, "Publishing should create the Markdown file through GitHub's contents API");
const putBody = JSON.parse(putRequest.init.body);
assert.equal(putBody.branch, "main");
assert.equal(putBody.message, 'Publish "Shipping queues safely"');
assert.equal(
  Buffer.from(putBody.content, "base64").toString("utf8"),
  `---
title: Shipping queues safely
date: 2026-07-10
summary: What failed and what changed.
tags: [reliability, celery]
status: published
---

# First section

Real body.
`,
);

const logoutResponse = await authenticatedWorker.fetch(
  new Request("https://admin.example/api/logout", {
    method: "POST",
    headers: {
      Cookie: `__Host-shubh_admin=${sessionCookie}`,
      Origin: "https://admin.example",
    },
  }),
  env,
);

assert.equal(logoutResponse.status, 204);
assert.match(
  logoutResponse.headers.get("Set-Cookie"),
  /__Host-shubh_admin=; Path=\/; Max-Age=0; HttpOnly; Secure; SameSite=Lax/,
);

const deniedWorker = createWorker({
  githubFetch: async (url) => {
    if (url === "https://github.com/login/oauth/access_token") {
      return Response.json({ access_token: "other-user-token" });
    }
    return Response.json({ login: "someone-else" });
  },
});
const deniedResponse = await deniedWorker.fetch(
  new Request("https://admin.example/auth/callback?code=oauth-code&state=expected", {
    headers: { Cookie: "__Host-shubh_oauth_state=expected" },
  }),
  env,
);

assert.equal(deniedResponse.status, 403);
assert.doesNotMatch(deniedResponse.headers.get("Set-Cookie") || "", /__Host-shubh_admin=/);

const invalidPublishResponse = await authenticatedWorker.fetch(
  new Request("https://admin.example/api/publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `__Host-shubh_admin=${sessionCookie}`,
      Origin: "https://admin.example",
    },
    body: JSON.stringify({
      title: "Unsafe title\nstatus: draft",
      date: "2026-07-10",
      summary: "Summary",
      tags: ["systems"],
      slug: "unsafe-post",
      body: "Body",
    }),
  }),
  env,
);

assert.equal(invalidPublishResponse.status, 400);
assert.deepEqual(await invalidPublishResponse.json(), {
  error: "Title must be one line.",
});

const assetResponse = await worker.fetch(
  new Request("https://admin.example/admin/"),
  {
    ...env,
    ASSETS: {
      fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`),
    },
  },
);

assert.equal(assetResponse.status, 200);
assert.equal(await assetResponse.text(), "asset:/admin/");
assert.equal(assetResponse.headers.get("X-Frame-Options"), "DENY");
assert.match(assetResponse.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
