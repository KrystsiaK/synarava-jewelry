import { db } from "@/lib/db";
import {
  runCollectorOnce,
  type CollectorRunResult,
} from "@/lib/mission-control/collector/run-once";

export type CollectorProcessDeps = {
  runOnce?: () => Promise<CollectorRunResult>;
  disconnect?: () => Promise<unknown>;
  exit?: (code: number) => void;
  logInfo?: (message: string) => void;
  logError?: (message: string) => void;
};

/**
 * One cron tick lifecycle: run → disconnect Prisma/pg → force exit.
 * Open pool handles otherwise keep the process alive until Railway kills it.
 */
export async function runCollectorProcess(
  deps: CollectorProcessDeps = {},
): Promise<void> {
  const runOnce = deps.runOnce ?? runCollectorOnce;
  const disconnect = deps.disconnect ?? (() => db.$disconnect());
  const exit = deps.exit ?? ((code: number) => process.exit(code));
  const logInfo = deps.logInfo ?? ((message: string) => console.info(message));
  const logError =
    deps.logError ?? ((message: string) => console.error(message));

  let exitCode = 0;
  try {
    const result = await runOnce();
    logInfo(
      `mission-control collector: done nodes=${result.nodesUpserted.join(",")} flows=${result.flowsUpserted.join(",")} alerts=${result.alertsSent.length} drift=${result.driftKeys.length}`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown error";
    logError(`mission-control collector: failed — ${message}`);
    exitCode = 1;
  } finally {
    await Promise.resolve(disconnect()).catch(() => undefined);
  }
  exit(exitCode);
}
