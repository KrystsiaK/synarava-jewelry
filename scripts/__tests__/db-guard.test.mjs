import { describe, expect, it } from "vitest";
import { findRemoteUrls, isLocalDbUrl } from "../db-guard.mjs";

const LOCAL = "postgresql://postgres:postgres@localhost:5432/synarava_ci";
const REMOTE = "postgresql://user:pw@db.example.invalid:6543/app";

describe("db-guard", () => {
  it("accepts only local database hosts", () => {
    expect(isLocalDbUrl(LOCAL)).toBe(true);
    expect(isLocalDbUrl("postgresql://u:p@127.0.0.1:5432/db")).toBe(true);
    expect(isLocalDbUrl("postgresql://u:p@[::1]:5432/db")).toBe(true);
    expect(isLocalDbUrl(REMOTE)).toBe(false);
    expect(isLocalDbUrl("postgresql://u:p@postgres.railway.internal:5432/db")).toBe(false);
    expect(isLocalDbUrl("not a url")).toBe(false);
  });

  it("passes when every URL is local", () => {
    expect(findRemoteUrls(["migrate", "dev"], { DATABASE_URL: LOCAL })).toEqual([]);
  });

  it("rejects a remote DATABASE_URL", () => {
    expect(findRemoteUrls(["db", "push"], { DATABASE_URL: REMOTE })).toEqual([REMOTE]);
  });

  it("rejects a production shadow URL in both flag forms and env", () => {
    const env = { DATABASE_URL: LOCAL };
    expect(findRemoteUrls(["migrate", "diff", `--shadow-database-url=${REMOTE}`], env)).toEqual([REMOTE]);
    expect(findRemoteUrls(["migrate", "diff", "--shadow-database-url", REMOTE], env)).toEqual([REMOTE]);
    expect(findRemoteUrls(["migrate", "dev"], { ...env, SHADOW_DATABASE_URL: REMOTE })).toEqual([REMOTE]);
  });
});
