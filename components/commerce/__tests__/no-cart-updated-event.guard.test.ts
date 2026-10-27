import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["components", "lib"] as const;
const FORBIDDEN = "synarava:cart-updated";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, out);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name) && !name.includes(".guard.test.")) {
      out.push(path);
    }
  }
  return out;
}

describe("cart badge event bus removed", () => {
  it(`forbids ${FORBIDDEN} under components/ and lib/`, () => {
    const hits: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(join(process.cwd(), root))) {
        const source = readFileSync(file, "utf8");
        if (source.includes(FORBIDDEN)) {
          hits.push(file.replace(`${process.cwd()}/`, ""));
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
