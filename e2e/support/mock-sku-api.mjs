#!/usr/bin/env node
/**
 * Minimal sku-api stand-in for Playwright Family-select e2e (listProfiles only).
 * Bind 127.0.0.1:4099 — pair with SKU_API_URL / SKU_API_TOKEN on the Next server.
 */
import http from "node:http";

const PORT = Number(process.env.MOCK_SKU_API_PORT || 4099);
const TOKEN = process.env.SKU_API_TOKEN || "e2e-sku-token-min8";

const profilesBody = JSON.stringify({
  ok: true,
  profiles: [
    {
      version: 1,
      status: "PUBLISHED",
      config: {
        families: {
          "jewelry.necklace": "JW-NECK",
          "jewelry.bracelet": "JW-BRACELET",
        },
      },
    },
  ],
});

const server = http.createServer((req, res) => {
  const auth = req.headers.authorization || "";
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (!auth.includes(TOKEN)) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, code: "UNAUTHORIZED", message: "bad token", correlationId: "e2e" }));
    return;
  }
  if (req.method === "GET" && /\/v1\/workspaces\/[^/]+\/profiles\/?$/.test(req.url || "")) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(profilesBody);
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, code: "NOT_FOUND", message: "mock", correlationId: "e2e" }));
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`mock-sku-api listening on 127.0.0.1:${PORT}\n`);
});
