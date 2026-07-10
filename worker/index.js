function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function secureRandomToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function base64UrlBytes(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function cookiesFrom(request) {
  return Object.fromEntries(
    (request.headers.get("Cookie") || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        return separator === -1
          ? [part, ""]
          : [part.slice(0, separator), part.slice(separator + 1)];
      }),
  );
}

function cookie(name, value, options) {
  return [
    `${name}=${value}`,
    "Path=/",
    `Max-Age=${options.maxAge}`,
    options.httpOnly ? "HttpOnly" : "",
    "Secure",
    `SameSite=${options.sameSite || "Lax"}`,
  ].filter(Boolean).join("; ");
}

async function sessionKey(secret) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSession(session, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await sessionKey(secret),
    new TextEncoder().encode(JSON.stringify(session)),
  );
  return `${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

async function decryptSession(value, secret, now) {
  if (!value || !secret) return null;
  try {
    const [encodedIv, encodedPayload] = value.split(".");
    if (!encodedIv || !encodedPayload) return null;
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlBytes(encodedIv) },
      await sessionKey(secret),
      base64UrlBytes(encodedPayload),
    );
    const session = JSON.parse(new TextDecoder().decode(decrypted));
    if (session.version !== 1 || session.expiresAt <= now()) return null;
    return session;
  } catch {
    return null;
  }
}

function githubHeaders(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "shubh-portfolio-admin",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function bytesToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function singleLine(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${field} is too long.`);
  if (/[\r\n]/.test(trimmed)) throw new Error(`${field} must be one line.`);
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    throw new Error(`${field} cannot be wrapped in square brackets.`);
  }
  return trimmed;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function postFrom(payload) {
  const title = singleLine(payload?.title, "Title", 180);
  const summary = singleLine(payload?.summary, "Summary", 320);
  const slug = typeof payload?.slug === "string" ? payload.slug.trim() : "";
  if (slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Slug must contain lowercase letters, numbers, and single hyphens.");
  }
  if (!validDate(payload?.date)) throw new Error("Date must be a valid YYYY-MM-DD value.");
  if (!Array.isArray(payload?.tags) || payload.tags.length === 0 || payload.tags.length > 10) {
    throw new Error("Add between one and ten tags.");
  }
  const tags = payload.tags.map((tag) => {
    const normalized = typeof tag === "string" ? tag.trim().toLowerCase() : "";
    if (normalized.length > 40 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
      throw new Error("Tags may contain lowercase letters, numbers, and single hyphens.");
    }
    return normalized;
  });
  if (new Set(tags).size !== tags.length) throw new Error("Tags must be unique.");
  if (typeof payload?.body !== "string" || !payload.body.trim()) {
    throw new Error("Post body is required.");
  }
  if (payload.body.length > 250_000) throw new Error("Post body is too long.");
  const body = payload.body.replaceAll("\r\n", "\n").trim();

  return {
    slug,
    title,
    source: `---\ntitle: ${title}\ndate: ${payload.date}\nsummary: ${summary}\ntags: [${tags.join(", ")}]\nstatus: published\n---\n\n${body}\n`,
  };
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function assetResponse(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (!new URL(request.url).pathname.startsWith("/admin")) return response;

  const headers = new Headers(response.headers);
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; form-action 'self' https://github.com; frame-ancestors 'none'; img-src 'self' data: https:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createWorker({
  githubFetch = globalThis.fetch,
  now = Date.now,
  randomToken = secureRandomToken,
} = {}) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/api/session") {
        const session = await decryptSession(
          cookiesFrom(request)["__Host-shubh_admin"],
          env.SESSION_SECRET,
          now,
        );
        if (!session) return json({ authenticated: false }, { status: 401 });
        return json({ authenticated: true, login: session.login });
      }

      if (request.method === "GET" && url.pathname === "/auth/login") {
        const state = randomToken();
        const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
        authorizationUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
        authorizationUrl.searchParams.set("redirect_uri", `${url.origin}/auth/callback`);
        authorizationUrl.searchParams.set("scope", "public_repo");
        authorizationUrl.searchParams.set("state", state);

        return new Response(null, {
          status: 302,
          headers: {
            Location: authorizationUrl.toString(),
            "Set-Cookie": cookie("__Host-shubh_oauth_state", state, {
              httpOnly: true,
              maxAge: 600,
            }),
          },
        });
      }

      if (request.method === "GET" && url.pathname === "/auth/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const expectedState = cookiesFrom(request)["__Host-shubh_oauth_state"];
        if (!code || !state || !expectedState || state !== expectedState) {
          return json({ error: "Invalid OAuth callback." }, { status: 400 });
        }

        const tokenResponse = await githubFetch(
          "https://github.com/login/oauth/access_token",
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "shubh-portfolio-admin",
            },
            body: new URLSearchParams({
              client_id: env.GITHUB_CLIENT_ID,
              client_secret: env.GITHUB_CLIENT_SECRET,
              code,
              redirect_uri: `${url.origin}/auth/callback`,
            }),
          },
        );
        const tokenResult = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenResult.access_token) {
          return json({ error: "GitHub authentication failed." }, { status: 502 });
        }

        const userResponse = await githubFetch("https://api.github.com/user", {
          headers: githubHeaders(tokenResult.access_token),
        });
        const user = await userResponse.json();
        if (!userResponse.ok) {
          return json({ error: "Could not read the GitHub account." }, { status: 502 });
        }
        if (user.login?.toLowerCase() !== env.ALLOWED_GITHUB_LOGIN.toLowerCase()) {
          return json({ error: "This GitHub account is not an administrator." }, { status: 403 });
        }

        const maxAge = 8 * 60 * 60;
        const sessionValue = await encryptSession(
          {
            version: 1,
            login: user.login,
            accessToken: tokenResult.access_token,
            expiresAt: now() + maxAge * 1000,
          },
          env.SESSION_SECRET,
        );
        const headers = new Headers({
          Location: `${url.origin}/admin/`,
        });
        headers.append(
          "Set-Cookie",
          cookie("__Host-shubh_admin", sessionValue, {
            httpOnly: true,
            maxAge,
          }),
        );
        headers.append(
          "Set-Cookie",
          cookie("__Host-shubh_oauth_state", "", {
            httpOnly: true,
            maxAge: 0,
          }),
        );
        return new Response(null, { status: 302, headers });
      }

      if (request.method === "POST" && url.pathname === "/api/publish") {
        if (request.headers.get("Origin") !== url.origin) {
          return json({ error: "Invalid request origin." }, { status: 403 });
        }
        const session = await decryptSession(
          cookiesFrom(request)["__Host-shubh_admin"],
          env.SESSION_SECRET,
          now,
        );
        if (
          !session ||
          session.login.toLowerCase() !== env.ALLOWED_GITHUB_LOGIN.toLowerCase()
        ) {
          return json({ error: "Authentication required." }, { status: 401 });
        }

        let payload;
        try {
          payload = await request.json();
        } catch {
          return json({ error: "Request body must be valid JSON." }, { status: 400 });
        }

        let post;
        try {
          post = postFrom(payload);
        } catch (error) {
          return json({ error: error.message }, { status: 400 });
        }

        const repository = `${encodeURIComponent(env.REPO_OWNER)}/${encodeURIComponent(env.REPO_NAME)}`;
        const path = `content/writings/${post.slug}.md`;
        const endpoint = `https://api.github.com/repos/${repository}/contents/${path}`;
        const headers = githubHeaders(session.accessToken);
        const existingResponse = await githubFetch(`${endpoint}?ref=main`, { headers });
        if (existingResponse.ok) {
          return json({ error: "A post with this slug already exists." }, { status: 409 });
        }
        if (existingResponse.status !== 404) {
          const failure = await responseJson(existingResponse);
          return json(
            { error: failure.message || "GitHub could not check the post path." },
            { status: 502 },
          );
        }

        const createResponse = await githubFetch(endpoint, {
          method: "PUT",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Publish \"${post.title}\"`,
            content: bytesToBase64(post.source),
            branch: "main",
          }),
        });
        const created = await responseJson(createResponse);
        if (!createResponse.ok) {
          return json(
            { error: created.message || "GitHub could not publish the post." },
            { status: createResponse.status === 422 ? 409 : 502 },
          );
        }

        const articleUrl = new URL(env.FRONTEND_ORIGIN);
        articleUrl.searchParams.set("post", post.slug);
        return json(
          {
            articleUrl: articleUrl.toString(),
            commitUrl: created.commit?.html_url || "",
            fileUrl: created.content?.html_url || "",
          },
          { status: 201 },
        );
      }

      if (request.method === "POST" && url.pathname === "/api/logout") {
        if (request.headers.get("Origin") !== url.origin) {
          return json({ error: "Invalid request origin." }, { status: 403 });
        }
        return new Response(null, {
          status: 204,
          headers: {
            "Set-Cookie": cookie("__Host-shubh_admin", "", {
              httpOnly: true,
              maxAge: 0,
            }),
          },
        });
      }

      if (env.ASSETS) return assetResponse(request, env);
      return new Response("Not found", { status: 404 });
    },
  };
}

export default createWorker();
