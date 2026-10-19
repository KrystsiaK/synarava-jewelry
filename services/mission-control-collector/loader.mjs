/**
 * Node ESM loader: resolve `@/` to repo root and attach JSON import attributes.
 * Zero npm dependencies — Railway start uses Node 22 `--experimental-strip-types`.
 */
import { existsSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), "../..");

function resolveAlias(specifier) {
  if (!specifier.startsWith("@/")) return null;
  const base = pathResolve(ROOT, specifier.slice(2));
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.json`,
    pathResolve(base, "index.ts"),
  ]) {
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const aliased = resolveAlias(specifier);
  if (aliased) {
    return nextResolve(aliased, context);
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    return nextLoad(url, {
      ...context,
      importAttributes: { ...context.importAttributes, type: "json" },
    });
  }
  return nextLoad(url, context);
}
