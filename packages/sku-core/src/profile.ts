export type SuffixPolicy = {
  readonly width: number;
  readonly start: number;
  /** When false, cancelled/expired sequences remain tombstones and are never reused. */
  readonly reuse: false;
};

export type PolicyProfileConfig = {
  readonly workspace: string;
  readonly version: number;
  readonly separator: string;
  readonly suffix: SuffixPolicy;
  readonly families: Readonly<Record<string, string>>;
  /** Full-string regex source, e.g. ^[A-Z0-9]+(-[A-Z0-9.]+)*$ */
  readonly allowedCharacters: string;
};

export const SYNARAVA_SHOP_PROFILE_V1_EXAMPLE = {
  workspace: "synarava-shop",
  version: 1,
  separator: "-",
  suffix: { width: 3, start: 1, reuse: false },
  families: {
    "jewelry.necklace": "JW-NECK",
    "jewelry.bracelet": "JW-BRACELET",
    "bag.charm": "BA-CH",
    "craft.thread": "DIY-THREAD",
  },
  allowedCharacters: "^[A-Z0-9]+(-[A-Z0-9.]+)*$",
} as const satisfies PolicyProfileConfig;
