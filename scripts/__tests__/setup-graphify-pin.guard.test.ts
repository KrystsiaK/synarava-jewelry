import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL: scripts/setup-graphify.sh must pin graphifyy to an exact ==X.Y.Z.
 * Floating / --upgrade-to-latest installs are forbidden (reproducible cloud/local setup).
 */

const SCRIPT = join(process.cwd(), "scripts/setup-graphify.sh");

describe("setup-graphify pin guard", () => {
  const src = readFileSync(SCRIPT, "utf8");

  it("declares GRAPHIFYY_VERSION as X.Y.Z and pins graphifyy[leiden]==that version", () => {
    const versionMatch = src.match(/^GRAPHIFYY_VERSION="(\d+\.\d+\.\d+)"$/m);
    expect(versionMatch, "GRAPHIFYY_VERSION=X.Y.Z required").not.toBeNull();
    const version = versionMatch![1];

    expect(src).toMatch(
      new RegExp(
        `^GRAPHIFYY_SPEC="graphifyy\\[leiden\\]==\\$\\{GRAPHIFYY_VERSION\\}"$`,
        "m",
      ),
    );
    expect(src).toContain(`graphifyy[leiden]==\${GRAPHIFYY_VERSION}`);
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("does not install floating/latest or --upgrade to unpinned latest", () => {
    expect(src).not.toMatch(/uv tool install --upgrade\b/);
    expect(src).not.toMatch(/pip install --user[^\n]*--upgrade[^\n]*graphifyy/);
    expect(src).not.toMatch(/graphifyy\[leiden\](?!==)/);
    expect(src).toMatch(/\$GRAPHIFYY_SPEC\b/);
  });

  it("--check does not hit PyPI / compare to latest on the network", () => {
    const checkBlock = src.slice(src.indexOf('if [ "$check" = 1 ]'), src.indexOf("# Install pinned CLI"));
    expect(checkBlock).not.toMatch(/pypi\.org/i);
    expect(checkBlock).not.toMatch(/\bcurl\b/);
    expect(checkBlock).toContain('"$cur" != "$GRAPHIFYY_VERSION"');
  });
});
