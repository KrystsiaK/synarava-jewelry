import { describe, expect, it } from "vitest";

import {
  areListStatesEqual,
  defaultListState,
  defineListStateSchema,
  enumField,
  hasListStateParams,
  isDefaultListState,
  listStateToSearchString,
  mergeListState,
  optionalEnumField,
  optionalStringField,
  parseListState,
  parseListStateRecord,
  sentinelField,
  serializeListState,
  stringField,
} from "@/lib/list-state";

const SORTS = ["featured", "newest", "price-asc"] as const;
const STATUSES = ["ALL", "ACTIVE", "DRAFT"] as const;

const demoSchema = defineListStateSchema({
  q: stringField({ key: "q" }),
  status: sentinelField({ key: "status", defaultValue: "ALL" }),
  sort: enumField({ key: "sort", defaultValue: "featured", allowed: SORTS }),
  availability: optionalEnumField({ key: "availability", allowed: ["in-stock"] as const }),
  category: optionalStringField({ key: "category" }),
});

function roundTrip(state: {
  q: string;
  status: string;
  sort: (typeof SORTS)[number];
  availability: "in-stock" | undefined;
  category: string | undefined;
}) {
  return parseListState(demoSchema, serializeListState(demoSchema, state));
}

describe("list-state codec", () => {
  it("defaults when source is empty", () => {
    const state = parseListState(demoSchema, new URLSearchParams());
    expect(state).toEqual({
      q: "",
      status: "ALL",
      sort: "featured",
      availability: undefined,
      category: undefined,
    });
    expect(isDefaultListState(demoSchema, state)).toBe(true);
    expect(listStateToSearchString(demoSchema, state)).toBe("");
  });

  it("parses a Next.js-style record the same as URLSearchParams", () => {
    const fromParams = parseListState(
      demoSchema,
      new URLSearchParams("q=pearl&status=ACTIVE&sort=newest&availability=in-stock&category=rings"),
    );
    const fromRecord = parseListState(demoSchema, {
      q: "pearl",
      status: "ACTIVE",
      sort: "newest",
      availability: "in-stock",
      category: "rings",
    });
    expect(fromRecord).toEqual(fromParams);
    expect(areListStatesEqual(demoSchema, fromParams, fromRecord)).toBe(true);
  });

  it("takes the first value from array-shaped searchParams", () => {
    expect(
      parseListState(demoSchema, { sort: ["newest", "price-asc"], q: ["a", "b"] }),
    ).toEqual({
      q: "a",
      status: "ALL",
      sort: "newest",
      availability: undefined,
      category: undefined,
    });
  });

  it("omits defaults from the query string", () => {
    const params = serializeListState(demoSchema, {
      q: "",
      status: "ALL",
      sort: "featured",
      availability: undefined,
      category: undefined,
    });
    expect(params.toString()).toBe("");
  });

  it("round-trips non-default values", () => {
    const state = {
      q: "gold",
      status: "DRAFT",
      sort: "price-asc" as const,
      availability: "in-stock" as const,
      category: "earrings",
    };
    expect(roundTrip(state)).toEqual(state);
    expect(listStateToSearchString(demoSchema, state)).toBe(
      "q=gold&status=DRAFT&sort=price-asc&availability=in-stock&category=earrings",
    );
  });
});

describe("list-state invalid input fallback", () => {
  const invalidCases: Array<{ name: string; input: string; expectedSort: (typeof SORTS)[number] }> = [
    { name: "unknown sort", input: "sort=hacked", expectedSort: "featured" },
    { name: "empty sort", input: "sort=", expectedSort: "featured" },
    { name: "injection-looking sort", input: "sort=%3Cscript%3E", expectedSort: "featured" },
    { name: "numeric sort", input: "sort=1", expectedSort: "featured" },
  ];

  for (const testCase of invalidCases) {
    it(`drops ${testCase.name} to default`, () => {
      const state = parseListState(demoSchema, new URLSearchParams(testCase.input));
      expect(state.sort).toBe(testCase.expectedSort);
    });
  }

  const generatedJunk = ["__proto__", "constructor", "toString", "null", "undefined", " ", "\t", "PRICE-ASC", "Featured"];
  for (const junk of generatedJunk) {
    it(`rejects generated invalid sort ${JSON.stringify(junk)}`, () => {
      const state = parseListState(demoSchema, { sort: junk });
      expect(state.sort).toBe("featured");
    });
  }

  it("ignores unknown query keys", () => {
    const state = parseListState(
      demoSchema,
      new URLSearchParams("q=ok&evil=1&cursor=abc&limit=99"),
    );
    expect(state.q).toBe("ok");
    expect(listStateToSearchString(demoSchema, state)).toBe("q=ok");
  });

  it("rejects invalid optional enum", () => {
    expect(parseListState(demoSchema, { availability: "out-of-stock" }).availability).toBeUndefined();
  });
});

describe("list-state generated round-trips", () => {
  const queries = ["", "a", "pearl stud", "  trimmed  "];
  const statuses = [...STATUSES];
  const sorts = [...SORTS];
  const availabilities: Array<"in-stock" | undefined> = [undefined, "in-stock"];
  const categories: Array<string | undefined> = [undefined, "rings", "  bracelets  "];

  for (const q of queries) {
    for (const status of statuses) {
      for (const sort of sorts) {
        for (const availability of availabilities) {
          for (const category of categories) {
            const label = `q=${JSON.stringify(q)} status=${status} sort=${sort} availability=${String(availability)} category=${String(category)}`;
            it(`round-trips ${label}`, () => {
              const input = { q, status, sort, availability, category };
              const parsed = roundTrip(input);
              // serialize→parse normalizes whitespace the same way for every field
              expect(parsed).toEqual(parseListState(demoSchema, serializeListState(demoSchema, input)));
              // Second pass is idempotent
              expect(roundTrip(parsed)).toEqual(parsed);
            });
          }
        }
      }
    }
  }
});

describe("list-state helpers", () => {
  it("defaultListState matches empty parse", () => {
    expect(defaultListState(demoSchema)).toEqual(parseListState(demoSchema, {}));
  });

  it("hasListStateParams detects known keys even when invalid", () => {
    expect(hasListStateParams(demoSchema, new URLSearchParams())).toBe(false);
    expect(hasListStateParams(demoSchema, { cursor: "x" })).toBe(false);
    expect(hasListStateParams(demoSchema, { sort: "bogus" })).toBe(true);
    expect(hasListStateParams(demoSchema, new URLSearchParams("q=1"))).toBe(true);
  });

  it("mergeListState patches onto defaults through the whitelist", () => {
    expect(mergeListState(demoSchema, { sort: "newest", status: "ACTIVE" })).toEqual({
      q: "",
      status: "ACTIVE",
      sort: "newest",
      availability: undefined,
      category: undefined,
    });
    expect(mergeListState(demoSchema, { sort: "nope" as "featured" }).sort).toBe("featured");
  });

  it("parseListStateRecord restores storage bags safely", () => {
    expect(
      parseListStateRecord(demoSchema, {
        q: "silver",
        status: "DRAFT",
        sort: "newest",
        availability: "in-stock",
        category: "rings",
        cursor: "should-ignore",
      }),
    ).toEqual({
      q: "silver",
      status: "DRAFT",
      sort: "newest",
      availability: "in-stock",
      category: "rings",
    });

    expect(parseListStateRecord(demoSchema, null)).toEqual(defaultListState(demoSchema));
    expect(parseListStateRecord(demoSchema, { sort: "evil" }).sort).toBe("featured");
  });

  it("SSR record parse equals URLSearchParams parse for the same inputs", () => {
    const cases = [
      "",
      "q=gold",
      "sort=newest",
      "sort=nope&q=x",
      "status=ACTIVE&availability=in-stock&category=rings",
    ];
    for (const query of cases) {
      const params = new URLSearchParams(query);
      const record: Record<string, string> = {};
      params.forEach((value, key) => {
        record[key] = value;
      });
      expect(parseListState(demoSchema, record)).toEqual(parseListState(demoSchema, params));
    }
  });
});
