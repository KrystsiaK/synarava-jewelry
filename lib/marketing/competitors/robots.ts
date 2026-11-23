export type RobotsRule = {
  allow: boolean;
  pattern: string;
};

export type RobotsPolicy = {
  allowed: (path: string) => boolean;
  crawlDelaySeconds: number;
  sitemaps: string[];
};

function escapeRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\\\$$/, "$");
  return new RegExp(`^${escaped}`);
}

/**
 * Minimal robots.txt parser: User-agent `*` group only.
 * Longest-match Allow/Disallow wins; Crawl-delay from the `*` group.
 */
export function parseRobotsTxt(text: string): RobotsPolicy {
  const rules: RobotsRule[] = [];
  const sitemaps: string[] = [];
  let on = false;
  let crawlDelaySeconds = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();

    if (key === "sitemap" && value) {
      sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      on = value === "*";
      continue;
    }
    if (!on) continue;
    if ((key === "allow" || key === "disallow") && value) {
      rules.push({ allow: key === "allow", pattern: value });
      continue;
    }
    if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) crawlDelaySeconds = n;
    }
  }

  const allowed = (path: string): boolean => {
    let best: RobotsRule | null = null;
    for (const rule of rules) {
      if (!escapeRegex(rule.pattern).test(path)) continue;
      if (!best || rule.pattern.length > best.pattern.length) best = rule;
    }
    return !best || best.allow;
  };

  return { allowed, crawlDelaySeconds, sitemaps };
}
