import {
  buildAlertMessage,
  shouldAlertOnLevelChange,
} from "@/lib/mission-control/collector/alerts";
import {
  findDriftNodeKeys,
  wiringConfigNodeKeys,
} from "@/lib/mission-control/collector/drift";
import { sendTelegramAlert } from "@/lib/mission-control/collector/telegram";
import {
  LIVE_NODE_KEYS,
  PLACEHOLDER_NODE_KEYS,
} from "@/lib/mission-control/live-snapshot";
import { MISSION_CONTROL_NODE_CATALOG } from "@/lib/mission-control/node-catalog";
import { getOrdersStatus } from "@/lib/mission-control/providers/orders";
import { getShopifySyncStatus } from "@/lib/mission-control/providers/shopify-sync";
import { getSiteHealthStatus } from "@/lib/mission-control/providers/site-health";
import { Prisma } from "@prisma/client";
import {
  readServiceFlowStatus,
  readServiceNodeStatus,
  writeServiceFlowStatus,
  writeServiceNodeStatus,
  type ServiceNodeStatusRecord,
  type ServiceStatusLevel,
} from "@/lib/mission-control/status";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

function countersForWrite(
  counters: ServiceNodeStatusRecord["counters"],
): Prisma.InputJsonValue | null {
  if (counters === null) return null;
  return counters as Prisma.InputJsonValue;
}

const PROVIDER_KEY_SET: ReadonlySet<string> = new Set(LIVE_NODE_KEYS);
const PLACEHOLDER_KEY_SET: ReadonlySet<string> = new Set(PLACEHOLDER_NODE_KEYS);

const LABEL_BY_KEY = new Map(
  MISSION_CONTROL_NODE_CATALOG.map((node) => [node.widgetKey, node.label]),
);

export type CollectorEnv = {
  APP_URL?: string | null;
  TELEGRAM_BOT_TOKEN?: string | null;
  TELEGRAM_CHAT_ID?: string | null;
};

export type CollectorDeps = {
  now?: Date;
  env?: CollectorEnv;
  fetchFn?: typeof fetch;
  getSiteHealthStatus?: typeof getSiteHealthStatus;
  getShopifySyncStatus?: typeof getShopifySyncStatus;
  getOrdersStatus?: typeof getOrdersStatus;
  readServiceNodeStatus?: typeof readServiceNodeStatus;
  writeServiceNodeStatus?: typeof writeServiceNodeStatus;
  readServiceFlowStatus?: typeof readServiceFlowStatus;
  writeServiceFlowStatus?: typeof writeServiceFlowStatus;
  sendTelegramAlert?: typeof sendTelegramAlert;
  log?: (message: string) => void;
};

export type CollectorRunResult = {
  nodesUpserted: string[];
  flowsUpserted: string[];
  alertsSent: string[];
  alertsFailed: string[];
  driftKeys: string[];
};

function hubUrlFromEnv(env: CollectorEnv): string {
  const base = (env.APP_URL ?? "").replace(/\/$/, "");
  if (!base) return "/admin/mission-control";
  return `${base}/admin/mission-control`;
}

function nodeLabel(nodeKey: string): string {
  return LABEL_BY_KEY.get(nodeKey) ?? nodeKey;
}

/**
 * One cron tick: probe live providers, upsert status rows, alert on
 * warn/down transitions, log WiringConfig drift. Never restarts/fixes anything.
 */
export async function runCollectorOnce(
  deps: CollectorDeps = {},
): Promise<CollectorRunResult> {
  const now = deps.now ?? new Date();
  const env = deps.env ?? {
    APP_URL: process.env.APP_URL ?? null,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? null,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? null,
  };
  const log = deps.log ?? ((message: string) => console.info(message));
  const probeSite = deps.getSiteHealthStatus ?? getSiteHealthStatus;
  const probeShopify = deps.getShopifySyncStatus ?? getShopifySyncStatus;
  const probeOrders = deps.getOrdersStatus ?? getOrdersStatus;
  const readNode = deps.readServiceNodeStatus ?? readServiceNodeStatus;
  const writeNode = deps.writeServiceNodeStatus ?? writeServiceNodeStatus;
  const readFlow = deps.readServiceFlowStatus ?? readServiceFlowStatus;
  const writeFlow = deps.writeServiceFlowStatus ?? writeServiceFlowStatus;
  const sendAlert = deps.sendTelegramAlert ?? sendTelegramAlert;
  const fetchFn = deps.fetchFn ?? fetch;

  const [siteHealth, shopifySync, orders] = await Promise.all([
    probeSite({ now, fetchFn }),
    probeShopify({ now }),
    probeOrders({ now }),
  ]);

  const liveNodes: ServiceNodeStatusRecord[] = [
    siteHealth,
    shopifySync,
    orders,
  ];
  const nodesUpserted: string[] = [];
  const alertsSent: string[] = [];
  const alertsFailed: string[] = [];
  const hubUrl = hubUrlFromEnv(env);

  for (const node of liveNodes) {
    const previous = await readNode(node.nodeKey);
    const previousLevel: ServiceStatusLevel | null = previous?.level ?? null;

    await writeNode({
      nodeKey: node.nodeKey,
      level: node.level,
      message: node.message,
      counters: countersForWrite(node.counters),
      href: node.href,
      checkedAt: node.checkedAt,
    });
    nodesUpserted.push(node.nodeKey);

    if (!shouldAlertOnLevelChange(previousLevel, node.level)) {
      continue;
    }

    const text = buildAlertMessage({
      nodeName: nodeLabel(node.nodeKey),
      level: node.level,
      hubUrl,
    });

    const result = await sendAlert(text, {
      fetchFn,
      botToken: env.TELEGRAM_BOT_TOKEN,
      chatId: env.TELEGRAM_CHAT_ID,
    });

    if (result.ok && !result.skipped) {
      alertsSent.push(node.nodeKey);
    } else if (!result.ok) {
      alertsFailed.push(node.nodeKey);
      log(
        `mission-control collector: telegram alert failed for ${node.nodeKey} (${result.error})`,
      );
    }
  }

  const wiring = getMissionControlWiringConfig();
  const statusByKey = new Map(liveNodes.map((row) => [row.nodeKey, row]));
  const flowsUpserted: string[] = [];

  for (const binding of wiring.systemBindings ?? []) {
    const sourceKey = binding.source?.widgetKey;
    if (!sourceKey) continue;
    const source = statusByKey.get(sourceKey);
    if (!source) continue;

    const previousFlow = await readFlow(binding.busKey);
    const lastFlowAt =
      source.level === "ok"
        ? now
        : (previousFlow?.lastFlowAt ?? null);

    await writeFlow({
      busKey: binding.busKey,
      level: source.level,
      lastFlowAt,
    });
    flowsUpserted.push(binding.busKey);
  }

  const driftKeys = findDriftNodeKeys({
    wiringNodeKeys: wiringConfigNodeKeys(wiring),
    providerKeys: PROVIDER_KEY_SET,
    placeholderKeys: PLACEHOLDER_KEY_SET,
  });

  for (const key of driftKeys) {
    log(
      `mission-control collector: drift — WiringConfig node "${key}" has no provider and is not marked placeholder`,
    );
  }

  return {
    nodesUpserted,
    flowsUpserted,
    alertsSent,
    alertsFailed,
    driftKeys,
  };
}
