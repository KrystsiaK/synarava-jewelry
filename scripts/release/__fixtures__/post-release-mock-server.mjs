#!/usr/bin/env node
/**
 * Localhost-only mock storefront for exercising post-release-check.mjs.
 * Not for prod/staging. Serves read-only HTML/JSON that mirrors the selectors
 * the check script uses.
 */
import http from "node:http";
import { pathToFileURL } from "node:url";

const TOTAL = 12;
const RING_COUNT = 3;
const EXPECT_SHA_DEFAULT = "abcdef12";

function shopPageHtml(productType) {
  const filtered = productType === "Ring";
  const count = filtered ? RING_COUNT : TOTAL;
  const cards = Array.from({ length: count }, (_, i) => {
    const id = filtered ? `ring-${i + 1}` : `p-${i + 1}`;
    return `<article data-product-id="${id}"><a href="/en/product/${id}">Item ${id}</a></article>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Mock shop</title>
  <style>
    .artifact-footer__wordmark { color: rgba(25, 21, 18, 0.05); }
  </style>
</head>
<body>
  <main id="shop-products">
    <section>
      <h2 id="shop-product-type-title">Shop by product type</h2>
      <a href="/en/shop?productType=Ring">Rings ${RING_COUNT} products</a>
      <a href="/en/shop?productType=Necklace">Necklaces 9 products</a>
    </section>
    <p aria-live="polite">Showing ${count} products</p>
    <div id="shop-product-grid">${cards}</div>
  </main>
  <footer>
    <div class="artifact-footer__wordmark" aria-hidden="true">SYNARAVA</div>
  </footer>
</body>
</html>`;
}

function homeHtml(locale, expectSha) {
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8"/>
  <title>Mock ${locale}</title>
  <link rel="preload" href="/_next/static/media/font.woff2?dpl=${expectSha}" as="font"/>
  <style>
    .artifact-footer__wordmark { color: rgba(25, 21, 18, 0.05); }
  </style>
</head>
<body>
  <h1>Home ${locale}</h1>
  <footer>
    <div class="artifact-footer__wordmark" aria-hidden="true">SYNARAVA</div>
  </footer>
</body>
</html>`;
}

/**
 * @param {{ port?: number, expectSha?: string }} [opts]
 */
export function startMockServer(opts = {}) {
  const expectSha = opts.expectSha ?? EXPECT_SHA_DEFAULT;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end("method not allowed");
      return;
    }

    if (url.pathname === "/api/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "mock", revision: expectSha.slice(0, 7) }));
      return;
    }

    if (url.pathname === "/en" || url.pathname === "/pt") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(homeHtml(url.pathname.slice(1), expectSha));
      return;
    }

    if (url.pathname === "/en/shop") {
      const productType = url.searchParams.get("productType");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(shopPageHtml(productType));
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  return new Promise((resolve) => {
    server.listen(opts.port ?? 0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : opts.port;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
        expectSha,
        close: () =>
          new Promise((r, j) => {
            server.close((err) => (err ? j(err) : r()));
          }),
      });
    });
  });
}

async function main() {
  const port = Number(process.env.PORT || 0) || 0;
  const mock = await startMockServer({ port });
  console.log(`mock listening on ${mock.baseUrl} expectSha=${mock.expectSha}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
