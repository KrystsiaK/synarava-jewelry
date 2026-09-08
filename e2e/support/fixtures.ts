import { test as base } from "@playwright/test";

import { cleanupTestData } from "./factories";

type AdminFixtures = {
  /**
   * A unique id for this test, used to prefix every record it creates
   * (`e2e-<runId>-...`). Deleted automatically after the test via
   * `cleanupTestData`, so specs never need to clean up after themselves —
   * only avoid asserting absolute counts, since the shared dev DB may hold
   * other workers' data at the same time.
   */
  runId: string;
};

export const test = base.extend<AdminFixtures>({
  runId: async ({}, use, testInfo) => {
    const runId = `${testInfo.workerIndex}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    // Playwright fixture teardown callback (`use`), not React's `use()` hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(runId);
    await cleanupTestData(runId);
  },
});

export { expect } from "@playwright/test";
