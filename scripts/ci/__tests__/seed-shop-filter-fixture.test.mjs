import { describe, expect, it } from "vitest";
import {
  ALLOWED_DB_HOSTS,
  assertSafeCiSeedEnv,
  databaseUrlHost,
  FIXTURE_PRODUCTS,
} from "../seed-shop-filter-fixture.mjs";

describe("seed-shop-filter-fixture safety", () => {
  it("allows only localhost, 127.0.0.1, and postgres hosts", () => {
    expect(ALLOWED_DB_HOSTS).toEqual(new Set(["localhost", "127.0.0.1", "postgres"]));
    expect(databaseUrlHost("postgresql://u:p@127.0.0.1:5432/synarava_ci")).toBe("127.0.0.1");
    expect(databaseUrlHost("postgresql://u:p@localhost:5432/db")).toBe("localhost");
    expect(databaseUrlHost("postgresql://u:p@postgres:5432/db")).toBe("postgres");
    expect(databaseUrlHost("postgresql://u:p@db.example.invalid:5432/db")).toBe("db.example.invalid");
  });

  it("refuses when CI is not true", () => {
    const result = assertSafeCiSeedEnv({
      ci: undefined,
      databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/synarava_ci",
    });
    expect(result.ok).toBe(false);
  });

  it("refuses remote DATABASE_URL hosts even when CI=true", () => {
    const result = assertSafeCiSeedEnv({
      ci: "true",
      databaseUrl: "postgresql://u:p@db.railway.internal:5432/app",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts CI=true with an allowed host", () => {
    expect(
      assertSafeCiSeedEnv({
        ci: "true",
        databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/synarava_ci",
      }),
    ).toEqual({ ok: true });
  });

  it("seeds enough productTypes that a tile count is strictly below total", () => {
    const byType = FIXTURE_PRODUCTS.reduce((map, row) => {
      map.set(row.productType, (map.get(row.productType) ?? 0) + 1);
      return map;
    }, new Map());
    const total = FIXTURE_PRODUCTS.length;
    const minTile = Math.min(...byType.values());
    expect(total).toBeGreaterThan(0);
    expect(minTile).toBeGreaterThan(0);
    expect(minTile).toBeLessThan(total);
    expect(byType.get("Ring")).toBe(3);
    expect(byType.get("Earrings")).toBe(2);
    expect(byType.get("Bracelet")).toBe(1);
  });
});
