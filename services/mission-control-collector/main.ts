/**
 * Mission Control Stage 5 collector — one cron tick, then exit.
 * Observe + notify only; never restart or repair services.
 *
 * Start (Railway): `pnpm mission-control:collect`
 */
import { db } from "@/lib/db";
import { runCollectorOnce } from "@/lib/mission-control/collector/run-once";

async function main(): Promise<void> {
  const result = await runCollectorOnce();
  console.info(
    `mission-control collector: done nodes=${result.nodesUpserted.join(",")} flows=${result.flowsUpserted.join(",")} alerts=${result.alertsSent.length} drift=${result.driftKeys.length}`,
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`mission-control collector: failed — ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined);
  });
