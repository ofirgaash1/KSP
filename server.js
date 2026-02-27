import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 3000;
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://ksp.co.il/",
  Origin: "https://ksp.co.il",
};

const cookieJar = new Map();

function isAllowedTarget(target) {
  try {
    const url = new URL(target);
    return url.protocol === "https:" && (url.hostname === "ksp.co.il" || url.hostname.endsWith(".ksp.co.il"));
  } catch {
    return false;
  }
}

function getCookieHeader(hostname) {
  const hostCookies = cookieJar.get(hostname);
  if (!hostCookies) return "";

  return Object.entries(hostCookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function storeCookies(hostname, response) {
  const rawHeaders = response.headers.raw?.() || {};
  const setCookies = rawHeaders["set-cookie"] || [];
  if (setCookies.length === 0) return;

  const hostCookies = cookieJar.get(hostname) || {};

  for (const cookie of setCookies) {
    const firstPart = cookie.split(";")[0];
    const equalsIndex = firstPart.indexOf("=");
    if (equalsIndex <= 0) continue;

    const name = firstPart.slice(0, equalsIndex).trim();
    const value = firstPart.slice(equalsIndex + 1).trim();
    if (name) hostCookies[name] = value;
  }

  cookieJar.set(hostname, hostCookies);
}

function looksBlocked(text = "") {
  const lower = text.toLowerCase();
  return (
    lower.includes("just a moment") ||
    lower.includes("challenge-platform") ||
    lower.includes("enable javascript and cookies") ||
    lower.includes("forbidden 403") ||
    lower.includes("access denied")
  );
}

async function fetchKspJson(target) {
  const targetUrl = new URL(target);
  const cookieHeader = getCookieHeader(targetUrl.hostname);
  const headers = {
    ...DEFAULT_HEADERS,
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };

  const response = await fetch(targetUrl.toString(), {
    headers,
    redirect: "follow",
  });

  storeCookies(targetUrl.hostname, response);

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: {
        error: "Upstream request failed",
        upstreamStatus: response.status,
        contentType,
        blocked: looksBlocked(text),
        snippet: text.slice(0, 250),
      },
    };
  }

  if (!contentType.includes("application/json")) {
    return {
      ok: false,
      status: 502,
      body: {
        error: "Upstream returned non-JSON content",
        upstreamStatus: response.status,
        contentType,
        blocked: looksBlocked(text),
        snippet: text.slice(0, 250),
      },
    };
  }

  try {
    return { ok: true, status: 200, body: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      status: 502,
      body: {
        error: "Failed to parse upstream JSON",
        upstreamStatus: response.status,
        contentType,
        blocked: looksBlocked(text),
        snippet: text.slice(0, 250),
      },
    };
  }
}

app.get("/api/products", async (req, res) => {
  try {
    const page = req.query.page || 1;
    const url = `https://ksp.co.il/m_action/api/category/38?sort=1&page=${page}`;
    const result = await fetchKspJson(url);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

app.get("/api/proxy", async (req, res) => {
  try {
    const target = req.query.target;
    if (!target) {
      return res.status(400).json({ error: "Missing target URL" });
    }

    if (!isAllowedTarget(target)) {
      return res.status(400).json({ error: "Invalid target URL" });
    }

    const result = await fetchKspJson(target);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Proxy failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
