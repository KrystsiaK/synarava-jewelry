/**
 * Mission Control Stage 5 collector — one cron tick, then exit.
 * Observe + notify only; never restart or repair services.
 *
 * Start (Railway): `pnpm mission-control:collect`
 */
import { runCollectorProcess } from "@/lib/mission-control/collector/entry";

void runCollectorProcess();
