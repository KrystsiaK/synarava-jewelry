// Read-only PoC: robots.txt -> sitemap -> sample product pages -> JSON-LD Product.
// usage: node poc.mjs <origin> [sampleN] [productUrlRegex]
const UA = "SynaravaResearchBot/0.1 (market research; read-only)";
const [origin, nArg = "6", reArg = "/products?/|/p/|\\.html$"] = process.argv.slice(2);
const N = Number(nArg);
const re = new RegExp(reArg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => {
  const r = await fetch(u, { headers: { "user-agent": UA, accept: "text/html,application/xml" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  if (r.status !== 200) return { status: r.status, text: "" };
  if (u.endsWith(".gz")) { const { gunzipSync } = await import("node:zlib"); return { status: 200, text: gunzipSync(Buffer.from(await r.arrayBuffer())).toString() }; }
  return { status: r.status, text: await r.text() };
};

// minimal robots: groups for "*" only, longest-match Allow/Disallow
function robots(txt) {
  const rules = []; let on = false, delay = 0; const sitemaps = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim(); const i = line.indexOf(":"); if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim();
    if (k === "sitemap") sitemaps.push(v);
    else if (k === "user-agent") on = v === "*";
    else if (on && (k === "allow" || k === "disallow") && v) rules.push({ allow: k === "allow", p: v });
    else if (on && k === "crawl-delay") delay = Number(v) || 0;
  }
  const toRe = (p) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
  const allowed = (path) => { let best = null; for (const r of rules) if (toRe(r.p).test(path) && (!best || r.p.length > best.p.length)) best = r; return !best || best.allow; };
  return { allowed, delay, sitemaps };
}

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));

function ldProducts(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    const walk = (x) => { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(walk);
      const t = [].concat(x["@type"] || []); if (t.includes("Product") || t.includes("ProductGroup")) out.push(x); if (x["@graph"]) walk(x["@graph"]); };
    walk(j);
  }
  return out;
}
const offersOf = (p) => { const o = [].concat(p.offers || []).flatMap((x) => x.offers ? [].concat(x.offers) : [x]);
  const vs = [].concat(p.hasVariant || []).flatMap((v) => [].concat(v.offers || [])); return [...o, ...vs]; };

const rb = robots((await get(origin + "/robots.txt")).text);
let queue = rb.sitemaps.length ? rb.sitemaps : [origin + "/sitemap.xml", origin + "/sitemap_index.xml"]; const products = []; const seen = new Set();
while (queue.length && products.length < 400 && seen.size < 15) {
  const sm = queue.shift(); if (seen.has(sm)) continue; seen.add(sm);
  if (!rb.allowed(new URL(sm).pathname)) continue;
  const { status, text } = await get(sm); if (status !== 200) continue;
  const ls = locs(text);
  if (/<sitemapindex/i.test(text)) queue.push(...ls.filter((u) => /product/i.test(u)), ...ls.filter((u) => !/product/i.test(u)));
  else products.push(...ls.filter((u) => re.test(new URL(u).pathname)));
}
const uniq = [...new Set(products)];
const sample = uniq.filter((_, i) => i % Math.max(1, Math.floor(uniq.length / N)) === 0).slice(0, N);
const delay = Math.max(1500, rb.delay * 1000);
const rows = [];
for (const u of sample) {
  const path = new URL(u).pathname;
  if (!rb.allowed(path)) { rows.push({ url: u, robots: "disallowed" }); continue; }
  await sleep(delay);
  const fetchedAt = new Date().toISOString();
  const { status, text } = await get(u);
  const p = ldProducts(text)[0];
  const offers = p ? offersOf(p) : [];
  let prices = offers.map((o) => Number(o.price ?? o.lowPrice)).filter(Number.isFinite);
  let source = p ? "json-ld" : null, ogCur = null;
  if (!prices.length) { const og = text.match(/og:price:amount" content="([0-9.,]+)"/); ogCur = text.match(/og:price:currency" content="([A-Z]{3})"/)?.[1] ?? null;
    if (og) { prices = [Number(og[1].replace(/\.(?=\d{3})/g, "").replace(",", "."))]; source = "og"; } }
  if (!prices.length && /\/products\/[^/]+$/.test(path) && rb.allowed(path + ".js")) { await sleep(delay); const js = await get(u + ".js");
    try { const j = JSON.parse(js.text); prices = [j.price / 100]; source = "shopify.js"; } catch {} }
  rows.push({ url: u, fetchedAt, status, jsonLd: !!p, name: p?.name, price: prices.length ? Math.min(...prices) : null,
    currency: offers[0]?.priceCurrency ?? ogCur, source, availability: offers[0]?.availability?.split("/").pop() ?? null,
    sku: p?.sku ?? offers[0]?.sku ?? null, reviews: p?.aggregateRating ? Number(p.aggregateRating.reviewCount ?? p.aggregateRating.ratingCount) : null, rating: p?.aggregateRating?.ratingValue ?? null, image: !!p?.image, brand: p?.brand?.name ?? p?.brand ?? null,
    fields: p ? Object.keys(p).join(",") : "" });
}
console.log(JSON.stringify({ origin, crawlDelay: rb.delay, sitemapsRead: seen.size, productUrls: uniq.length, rows }, null, 1));
