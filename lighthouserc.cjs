/**
 * Soft Lighthouse CI against the live storefront.
 * Canonical APP_URL / production origin: https://shop.synarava.com
 *
 * Assertions are warn-only (exit 0 on budget misses). The GitHub workflow also
 * uses continue-on-error so merge gates stay green while scores are collected.
 *
 * @see https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md
 */
const STOREFRONT = process.env.STOREFRONT_URL?.replace(/\/$/, "") || "https://shop.synarava.com";

/** Stable templates for lab scores (home / PDP / collection). */
const PATHS = [
  "/en",
  "/en/products/golden-bird-brooch",
  "/en/collections/jewellery",
];

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      url: PATHS.map((path) => `${STOREFRONT}${path}`),
      settings: {
        // Mobile lab form factor (Lighthouse default). Desktop can be added later.
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      },
    },
    assert: {
      // Soft: warn on regression vs aspirational floors; do not fail the job.
      assertLevel: "warn",
      assertions: {
        "categories:performance": ["warn", { minScore: 0.7 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.95 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
      reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%",
    },
  },
};
